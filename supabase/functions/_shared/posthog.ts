type CaptureProperties = Record<string, unknown>

export async function capturePostHogEvent(
  event: string,
  distinctId: string,
  properties: CaptureProperties = {},
) {
  const projectToken = Deno.env.get('VITE_PUBLIC_POSTHOG_PROJECT_TOKEN')
  const apiHost = Deno.env.get('VITE_PUBLIC_POSTHOG_HOST')

  if (!projectToken || !apiHost) {
    console.error(new Error('VITE_PUBLIC_POSTHOG_PROJECT_TOKEN and VITE_PUBLIC_POSTHOG_HOST variables required by PostHog are missing or un-configured, this causes events to be silently missed. This error stops appearing once they are configured'))
    return
  }

  try {
    const response = await fetch(`${apiHost.replace(/\/$/, '')}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: projectToken,
        event,
        properties: {
          distinct_id: distinctId,
          $lib: 'verticals-supabase-edge',
          ...properties,
        },
      }),
    })
    if (!response.ok) console.error('PostHog capture failed:', response.status)
  } catch (error) {
    console.error('PostHog capture failed:', error)
  }
}
