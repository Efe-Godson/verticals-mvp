// Place at: supabase/functions/_shared/stats.ts
// Shared by ai-analyst and ai-ask. Builds compact aggregate stats from
// submissions instead of dumping raw rows into the prompt, keeps token
// usage sane and gives the model clean numbers to reason over rather than
// re-deriving them itself.

const CATEGORICAL_TYPES = ['dropdown', 'multiplechoice', 'checkbox', 'autocomplete']
const NUMERIC_TYPES = ['number', 'rating', 'linearscale']
const SUBMISSION_ID_BATCH_SIZE = 50
const MAX_CONCURRENT_SUBMISSION_REQUESTS = 5

// The browser SDK sends authorization, apikey, and x-client-info headers when
// invoking a function. Explicitly permit those headers on the OPTIONS
// preflight request; otherwise browsers block the request before the Edge
// Function can run and report it as a failed send.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Both AI functions run with the service-role key (needed to read submissions
// regardless of RLS), which means they must do their own ownership check
// instead of relying on RLS to scope the query. This validates the caller's
// JWT (sent by supabase-js as the Authorization header) and confirms the
// resulting user actually owns the form they're asking about: without this,
// anyone who knows a form_id (they're used in public URLs) could pull another
// account's submission data or run up their Gemini bill.
export async function requireFormOwner(req: Request, supabase: any, formId: string) {
  const authHeader = req.headers.get('Authorization') || ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  if (!jwt) return { error: 'Missing Authorization header', status: 401 }

  const { data: userData, error: userError } = await supabase.auth.getUser(jwt)
  if (userError || !userData?.user) return { error: 'Invalid or expired session', status: 401 }

  const { data: form, error: formError } = await supabase
    .from('forms').select('*').eq('id', formId).single()
  if (formError || !form) return { error: 'Form not found', status: 404 }
  if (form.user_id !== userData.user.id) return { error: 'Form not found', status: 404 }

  return { form }
}

// PostgREST represents `.in()` filters in the URL. A report can contain many
// hundreds of selected submissions, which makes one request large enough for
// the network/proxy to reject it. Keep each URL small and combine the results.
export async function fetchSubmissions(supabase: any, formId: string, submissionIds?: string[]) {
  if (!submissionIds?.length) {
    const { data, error } = await supabase.from('submissions').select('*').eq('form_id', formId)
    if (error) throw error
    return data || []
  }

  const batches = Array.from(
    { length: Math.ceil(submissionIds.length / SUBMISSION_ID_BATCH_SIZE) },
    (_, index) => submissionIds.slice(index * SUBMISSION_ID_BATCH_SIZE, (index + 1) * SUBMISSION_ID_BATCH_SIZE)
  )
  const submissions: any[] = []
  for (let start = 0; start < batches.length; start += MAX_CONCURRENT_SUBMISSION_REQUESTS) {
    const responses = await Promise.all(batches.slice(start, start + MAX_CONCURRENT_SUBMISSION_REQUESTS).map(async ids => {
      const { data, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('form_id', formId)
        .in('id', ids)
      if (error) throw error
      return data || []
    }))
    submissions.push(...responses.flat())
  }

  return submissions
}

export function buildStats(form: any, submissions: any[]) {
  const stats: any = { totalResponses: submissions.length, fields: [] }

  const cartFields = form.fields.filter((f: any) => f.type === 'cart')
  const categoryFields = form.fields.filter((f: any) => CATEGORICAL_TYPES.includes(f.type))
  const numericFields = form.fields.filter((f: any) => NUMERIC_TYPES.includes(f.type))

  cartFields.forEach((field: any) => {
    const answered = submissions.filter(s => s.data[field.id]?.items?.length > 0)
    const totalRevenue = answered.reduce((sum, s) => sum + (s.data[field.id].total || 0), 0)
    const itemQty: Record<string, number> = {}
    const itemRevenue: Record<string, number> = {}

    answered.forEach(s => {
      s.data[field.id].items.forEach((item: any) => {
        itemQty[item.name] = (itemQty[item.name] || 0) + item.quantity
        itemRevenue[item.name] = (itemRevenue[item.name] || 0) + item.price * item.quantity
      })
    })

    stats.fields.push({
      label: field.label,
      type: 'cart',
      totalRevenue,
      orders: answered.length,
      avgOrderValue: answered.length ? totalRevenue / answered.length : 0,
      topByQuantity: Object.entries(itemQty).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 10),
      topByRevenue: Object.entries(itemRevenue).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 10),
    })
  })

  categoryFields.forEach((field: any) => {
    const counts: Record<string, number> = {}
    submissions.forEach(s => {
      const v = s.data[field.id]
      if (Array.isArray(v)) v.forEach((x: string) => { counts[x] = (counts[x] || 0) + 1 })
      else if (v) counts[v] = (counts[v] || 0) + 1
    })
    stats.fields.push({ label: field.label, type: 'category', counts })
  })

  numericFields.forEach((field: any) => {
    const values = submissions.map(s => Number(s.data[field.id])).filter(v => !isNaN(v))
    if (values.length) {
      stats.fields.push({
        label: field.label,
        type: 'numeric',
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length,
      })
    }
  })

  // Response volume bucketed by day, gives the model something to spot
  // trends/anomalies in without needing every raw timestamp.
  const dayCounts: Record<string, number> = {}
  submissions.forEach(s => {
    const day = new Date(s.created_at).toISOString().slice(0, 10)
    dayCounts[day] = (dayCounts[day] || 0) + 1
  })
  stats.responsesByDay = dayCounts

  return stats
}

export async function hashObject(obj: unknown) {
  const encoder = new TextEncoder()
  const data = encoder.encode(JSON.stringify(obj))
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}
