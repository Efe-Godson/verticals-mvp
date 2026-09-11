// Generates a migration that seeds a full year of demo data for each
// template (except Payroll - see the plan this was built from, its data
// lives in a completely separate dedicated schema, not submissions).
// Run: node scripts/generate-demo-seed.js
//
// Writes supabase/migrations/<timestamp>_seed_full_year_demo_data.sql -
// review the printed summary (row counts, monthly breakdown, annual
// totals) before ever pushing it. Deterministic (fixed RNG seed) so
// re-running produces the exact same data, not a moving target.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ---------------------------------------------------------------- RNG ---
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20260911)
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min
const choice = (arr) => arr[randInt(0, arr.length - 1)]
function weightedChoice(pairs) { // [[value, weight], ...]
  const total = pairs.reduce((s, [, w]) => s + w, 0)
  let r = rand() * total
  for (const [value, w] of pairs) { r -= w; if (r <= 0) return value }
  return pairs[pairs.length - 1][0]
}

// -------------------------------------------------------------- dates ---
const TODAY = new Date()
function daysAgo(n) {
  const d = new Date(TODAY)
  d.setDate(d.getDate() - n)
  return d
}
// `count` timestamps spread across the trailing 365 days. Weekend days get
// `weekendBoost`x the sampling weight of weekdays (cart-based businesses are
// busier then); non-cart datasets pass 1 for a flat distribution.
function generateDates(count, { weekendBoost = 1, hourRange = [8, 21] } = {}) {
  const weights = []
  for (let offset = 0; offset < 365; offset++) {
    const dow = daysAgo(offset).getDay()
    weights.push(dow === 0 || dow === 6 ? weekendBoost : 1)
  }
  const totalWeight = weights.reduce((a, b) => a + b, 0)
  const dates = []
  for (let i = 0; i < count; i++) {
    let r = rand() * totalWeight
    let offset = 0
    for (; offset < 364; offset++) { r -= weights[offset]; if (r <= 0) break }
    const d = daysAgo(offset)
    d.setHours(randInt(hourRange[0], hourRange[1]), randInt(0, 59), randInt(0, 59), 0)
    dates.push(d)
  }
  return dates.sort((a, b) => a - b)
}
function monthKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
function assertEveryTrailingMonthCovered(dates, label) {
  const months = new Set()
  for (let offset = 0; offset < 365; offset += 28) months.add(monthKey(daysAgo(offset)))
  const covered = new Set(dates.map(monthKey))
  const missing = [...months].filter(m => !covered.has(m))
  if (missing.length > 0) throw new Error(`${label}: no records in ${missing.join(', ')} - widen the date spread`)
}

// --------------------------------------------------------------- SQL ----
function sqlStr(v) { return `'${String(v).replace(/'/g, "''")}'` }
function sqlJson(obj) { return `'${JSON.stringify(obj).replace(/'/g, "''")}'::jsonb` }
function isoNoMillis(d) { return d.toISOString() }

// Chunks an array of {form_id, data, createdAt} into batched INSERT
// statements - one huge VALUES list is valid SQL but unreadable in a
// migration file meant to be reviewed by a person.
function submissionsInsertSQL(rows, chunkSize = 150) {
  const statements = []
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const values = chunk.map(r => `  (${sqlStr(r.form_id)}, ${sqlJson(r.data)}, ${sqlStr(isoNoMillis(r.createdAt))})`).join(',\n')
    statements.push(`insert into submissions (form_id, data, created_at) values\n${values};`)
  }
  return statements.join('\n\n')
}

// ============================================================ RESTAURANT
const RESTAURANT_FORM_ID = '11111111-1111-4111-8111-111111111111' // existing Mama's Kitchen
const RESTAURANT_MENU = [
  { id: 'p1', name: 'Jollof Rice', price: 1500, category: 'Mains' },
  { id: 'p2', name: 'Chicken & Chips', price: 2200, category: 'Mains' },
  { id: 'p3', name: 'Fried Rice', price: 1500, category: 'Mains' },
  { id: 'p4', name: 'Suya', price: 1000, category: 'Starters' },
  { id: 'p5', name: 'Moi Moi', price: 800, category: 'Starters' },
  { id: 'p6', name: 'Chapman', price: 700, category: 'Drinks' },
  { id: 'p7', name: 'Zobo', price: 500, category: 'Drinks' },
  { id: 'p8', name: 'Puff Puff', price: 300, category: 'Desserts' },
]
const NAMES = ['Tunde', 'Ada', 'Chidi', 'Ngozi', 'Emeka', 'Bisi', 'Kunle', 'Funmi', 'Ijeoma', 'Segun', 'Amara', 'Yemi', 'Chinwe', 'Tobi', 'Uche', 'Halima', 'Musa', 'Grace', 'Ola', 'Deji', 'Zainab', 'Femi', 'Aisha', 'Bola']

function generateCartOrder(catalogue, { minItems, maxItems, minQty, maxQty, deliveryFeeChance = 0 }) {
  const itemCount = randInt(minItems, maxItems)
  const picked = new Set()
  while (picked.size < itemCount && picked.size < catalogue.length) picked.add(choice(catalogue))
  const items = [...picked].map(p => ({ ...p, quantity: randInt(minQty, maxQty) }))
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0)
  const deliveryFee = rand() < deliveryFeeChance ? 500 : 0
  return { items, total, deliveryFee }
}

function buildRestaurantSubmissions(count) {
  const dates = generateDates(count, { weekendBoost: 1.6, hourRange: [10, 22] })
  assertEveryTrailingMonthCovered(dates, 'Restaurant')
  const rows = []
  let annualTotal = 0
  for (const createdAt of dates) {
    const { items, total, deliveryFee } = generateCartOrder(RESTAURANT_MENU, { minItems: 3, maxItems: 6, minQty: 2, maxQty: 5, deliveryFeeChance: 0.25 })
    const orderType = deliveryFee > 0 ? 'Delivery' : weightedChoice([['Dine-in', 3], ['Takeout', 2]])
    annualTotal += total + deliveryFee
    rows.push({
      form_id: RESTAURANT_FORM_ID,
      createdAt,
      data: {
        order: { items, total, payment: { method: weightedChoice([['Cash', 2], ['Card', 1]]) }, deliveryFee },
        order_type: orderType,
        customer_name: choice(NAMES),
        phone: `080${randInt(10000000, 99999999)}`,
      },
    })
  }
  return { rows, annualTotal }
}

// =========================================================== RETAIL ====
const RETAIL_FORM_ID = '33333333-3333-4333-8333-333333333333'
const RETAIL_DATASET_ID = '44444444-4444-4444-8444-444444444444'
const RETAIL_CATALOGUE = [
  { id: 'r1', name: 'Ankara Maxi Dress', price: 12000, category: 'Dresses' },
  { id: 'r2', name: "Men's Kaftan", price: 16000, category: 'Menswear' },
  { id: 'r3', name: 'Denim Jacket', price: 11000, category: 'Outerwear' },
  { id: 'r4', name: 'Leather Sandals', price: 7000, category: 'Footwear' },
  { id: 'r5', name: 'Sneakers', price: 15000, category: 'Footwear' },
  { id: 'r6', name: 'Beaded Necklace', price: 3500, category: 'Accessories' },
  { id: 'r7', name: 'Wristwatch', price: 20000, category: 'Accessories' },
  { id: 'r8', name: 'Wireless Earbuds', price: 17000, category: 'Electronics' },
  { id: 'r9', name: 'Phone Case', price: 3000, category: 'Electronics' },
  { id: 'r10', name: 'Tote Bag', price: 9000, category: 'Bags' },
]

function buildRetailSubmissions(count) {
  const dates = generateDates(count, { weekendBoost: 1.5, hourRange: [9, 20] })
  assertEveryTrailingMonthCovered(dates, 'Retail')
  const rows = []
  let annualTotal = 0
  for (const createdAt of dates) {
    const { items, total } = generateCartOrder(RETAIL_CATALOGUE, { minItems: 1, maxItems: 2, minQty: 1, maxQty: 1 })
    annualTotal += total
    rows.push({
      form_id: RETAIL_FORM_ID,
      createdAt,
      data: {
        order: { items, total, payment: { method: weightedChoice([['Card', 2], ['Cash', 1], ['Bank Transfer', 1]]) }, deliveryFee: 0 },
        customer_name: choice(NAMES),
        phone: `080${randInt(10000000, 99999999)}`,
      },
    })
  }
  return { rows, annualTotal }
}

// ========================================================= EXPENSES ====
const EXPENSES_FORM_ID = '55555555-5555-4555-8555-555555555555'
const EXPENSES_DATASET_ID = '66666666-6666-4666-8666-666666666666'
const EXPENSE_VENDORS = ['Shoprite', 'Total Filling Station', 'MTN', 'IKEDC', 'Jumia', 'Konga', 'Local Supplier Co', 'Prime Print & Pack', 'FastTrack Logistics', 'AA Rentals']

function buildExpensesSubmissions() {
  const rows = []
  let annualTotal = 0

  // Recurring monthly big-ticket items - one of each per month, spread over
  // the first week so they read as "paid at the start of the month".
  for (let monthOffset = 0; monthOffset < 12; monthOffset++) {
    const base = daysAgo(monthOffset * 30 + randInt(0, 4))
    const monthlyExpenses = [
      { category: 'Rent', amount: randInt(350000, 400000), vendor: 'AA Rentals' },
      { category: 'Staff', amount: randInt(200000, 240000), vendor: 'Payroll' },
      { category: 'Utilities', amount: randInt(35000, 55000), vendor: 'IKEDC' },
    ]
    monthlyExpenses.forEach(({ category, amount, vendor }) => {
      annualTotal += amount
      rows.push({
        form_id: EXPENSES_FORM_ID,
        createdAt: base,
        data: {
          amount, category, vendor,
          description: `${category} - ${base.toLocaleString('en-GB', { month: 'long', year: 'numeric' })}`,
          date: base.toISOString().slice(0, 10),
          time: base.toTimeString().slice(0, 5),
          payment_method: 'Bank Transfer',
          paid_from: 'Business account',
        },
      })
    })
  }

  // Frequent smaller/variable expenses, spread across the year.
  const smallCategories = ['Transport', 'Supplies', 'Marketing', 'Repairs & Maintenance', 'Food / Entertainment', 'Software & Subscriptions', 'Bank Charges', 'Inventory / Stock']
  const dates = generateDates(370, { weekendBoost: 0.6, hourRange: [9, 18] })
  assertEveryTrailingMonthCovered(dates, 'Expenses (small)')
  dates.forEach(createdAt => {
    const category = choice(smallCategories)
    const amount = category === 'Inventory / Stock' ? randInt(30000, 100000) : randInt(3000, 28000)
    annualTotal += amount
    rows.push({
      form_id: EXPENSES_FORM_ID,
      createdAt,
      data: {
        amount, category,
        vendor: choice(EXPENSE_VENDORS),
        description: `${category} expense`,
        date: createdAt.toISOString().slice(0, 10),
        time: createdAt.toTimeString().slice(0, 5),
        payment_method: weightedChoice([['Cash', 2], ['Card', 2], ['POS', 1], ['Bank Transfer', 1]]),
        paid_from: weightedChoice([['Business account', 3], ['Cash / Till', 1]]),
      },
    })
  })

  return { rows, annualTotal }
}

// ==================================================== DATA COLLECTION ===
const FEEDBACK_FORM_ID = '77777777-7777-4777-8777-777777777777'
const FEEDBACK_DATASET_ID = '88888888-8888-4888-8888-888888888888'
const HOW_HEARD = ['Instagram', 'Referral', 'Google', 'Walk-in', 'Other']
const COMMENTS_BY_RATING = {
  5: ['Absolutely loved it, will be back!', 'Best experience so far, highly recommend.', 'Excellent service from start to finish.'],
  4: ['Really good overall, small room for improvement.', 'Happy with it, would come again.', 'Great value, minor wait time.'],
  3: ['It was okay, nothing special.', 'Decent, but I expected a bit more.', 'Average experience.'],
  2: ['Not quite what I expected.', 'Service was slow, food/product was fine.', 'A few things could be better.'],
  1: ['Disappointed with the experience.', 'Had some real issues this time.', 'Would not recommend based on this visit.'],
}

function buildFeedbackSubmissions(count) {
  const dates = generateDates(count, { weekendBoost: 1, hourRange: [9, 19] })
  assertEveryTrailingMonthCovered(dates, 'Data Collection')
  const rows = []
  const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const createdAt of dates) {
    const rating = weightedChoice([[5, 40], [4, 35], [3, 15], [2, 7], [1, 3]])
    ratingCounts[rating]++
    const recommend = rating >= 4 ? 'Yes' : rating === 3 ? weightedChoice([['Yes', 1], ['No', 1]]) : 'No'
    rows.push({
      form_id: FEEDBACK_FORM_ID,
      createdAt,
      data: {
        name: choice(NAMES),
        email: `${choice(NAMES).toLowerCase()}${randInt(1, 99)}@example.com`,
        how_heard: choice(HOW_HEARD),
        rating,
        comments: choice(COMMENTS_BY_RATING[rating]),
        recommend,
      },
    })
  }
  return { rows, ratingCounts }
}

// ================================================================ RUN ===
const restaurant = buildRestaurantSubmissions(1000)
const retail = buildRetailSubmissions(800)
const expenses = buildExpensesSubmissions()
const feedback = buildFeedbackSubmissions(500)

function printSummary(label, rows, annualTotal) {
  const byMonth = {}
  rows.forEach(r => { const k = monthKey(r.createdAt); byMonth[k] = (byMonth[k] || 0) + 1 })
  console.log(`\n${label}: ${rows.length} records${annualTotal !== undefined ? `, ₦${annualTotal.toLocaleString()} total` : ''}`)
  Object.entries(byMonth).sort().forEach(([m, c]) => console.log(`  ${m}: ${c}`))
}
printSummary('Restaurant (Mama\'s Kitchen)', restaurant.rows, restaurant.annualTotal)
printSummary('Retail (Glow Fashion Retail)', retail.rows, retail.annualTotal)
printSummary('Expenses (Kola & Co Ventures)', expenses.rows, expenses.annualTotal)
printSummary('Data Collection (Customer Feedback)', feedback.rows)
console.log('\nFeedback rating distribution:', feedback.ratingCounts)

// Arithmetic self-check: every cart row's stored total must equal the sum
// of its own items - the exact class of bug caught by hand-typing the
// Phase 1 seed migration, now impossible to get wrong at this row count
// only if it's actually checked.
function verifyCartTotals(rows, label) {
  rows.forEach((r, i) => {
    const sum = r.data.order.items.reduce((s, it) => s + it.price * it.quantity, 0)
    if (sum !== r.data.order.total) throw new Error(`${label} row ${i}: computed ${sum} !== stored ${r.data.order.total}`)
  })
}
verifyCartTotals(restaurant.rows, 'Restaurant')
verifyCartTotals(retail.rows, 'Retail')
console.log('\nCart total arithmetic verified for Restaurant and Retail.')

// ============================================================ WRITE SQL =
const timestamp = '20260911160000'
const outPath = path.join(__dirname, '..', 'supabase', 'migrations', `${timestamp}_seed_full_year_demo_data.sql`)

const sql = `-- Seeds a full year of demo data for each template except Payroll (see the
-- plan this was built from - Payroll's data lives in a dedicated schema,
-- not submissions, and has no public view yet). Generated by
-- scripts/generate-demo-seed.js - re-run that script to regenerate rather
-- than hand-editing this file; see its printed summary for exact counts/
-- totals at generation time.

-- Restaurant (Mama's Kitchen): regenerate in place, same form - the old
-- Phase 1 seed (~18 orders over a week) is replaced with a full year so
-- Report's date-range filters (This month / Last 3-6-12 months) actually
-- differ from each other instead of all showing the same handful of rows.
delete from submissions where form_id = ${sqlStr(RESTAURANT_FORM_ID)};

${submissionsInsertSQL(restaurant.rows)}

-- Retail (new): its own Naira-priced catalogue rather than the retail-shop
-- template's literal seeded prices (those are small USD-style decimals,
-- e.g. $15.99, inconsistent with the ₦-whole-number convention every other
-- demo/seed in this app uses).
insert into forms (id, name, description, status, is_demo, user_id, settings, fields)
values (
  ${sqlStr(RETAIL_FORM_ID)},
  'Glow Fashion Retail',
  'A sample retail business, used to power the onboarding demo.',
  'published', true, '7d91d04c-d223-4ef1-a94d-382aa2d31bfe', '{}'::jsonb,
  ${sqlJson([
    { id: 'order', type: 'cart', label: 'Order', required: true, deferCheckout: true, products: RETAIL_CATALOGUE.map(p => ({ id: p.id, name: p.name, price: String(p.price), category: p.category })) },
    { id: 'customer_name', type: 'text', label: 'Customer Name', required: false, collapsedInCheckout: true },
    { id: 'phone', type: 'phone', label: 'Phone', required: false, collapsedInCheckout: true },
  ])}
)
on conflict (id) do nothing;

${submissionsInsertSQL(retail.rows)}

-- Expenses (new): same field shape as the real 'expenses' template, plus
-- the same settings.reportDateField/reportAmountField/recordKind a real
-- Expenses workspace gets from locations.js's expenseDefaults(), so
-- Report.jsx buckets it by its own \`date\` field the same way.
insert into forms (id, name, description, status, is_demo, user_id, settings, fields)
values (
  ${sqlStr(EXPENSES_FORM_ID)},
  'Kola & Co Ventures',
  'A sample business''s expense records, used to power the onboarding demo.',
  'published', true, '7d91d04c-d223-4ef1-a94d-382aa2d31bfe',
  ${sqlJson({ recordKind: 'expense', expenseMode: 'business', reportDateField: 'date', reportAmountField: 'amount' })},
  ${sqlJson([
    { id: 'amount', type: 'number', label: 'Amount', required: true },
    { id: 'category', type: 'dropdown', label: 'Category', required: true, options: ['Inventory / Stock', 'Supplies', 'Transport', 'Utilities', 'Rent', 'Staff', 'Marketing', 'Repairs & Maintenance', 'Equipment', 'Software & Subscriptions', 'Professional Services', 'Taxes / Fees', 'Food / Entertainment', 'Bank Charges', 'Other'] },
    { id: 'description', type: 'text', label: 'Description', required: false },
    { id: 'date', type: 'date', label: 'Date', required: false },
    { id: 'time', type: 'time', label: 'Time', required: false },
    { id: 'payment_method', type: 'dropdown', label: 'Payment method', required: false, options: ['Cash', 'Bank Transfer', 'Card', 'POS', 'Mobile Wallet', 'Other'] },
    { id: 'paid_from', type: 'dropdown', label: 'Paid from', required: false, options: ['Business account', 'Cash / Till', 'Personal account', 'Other'] },
    { id: 'vendor', type: 'text', label: 'Vendor / Supplier', required: false },
    { id: 'notes', type: 'longtext', label: 'Notes', required: false },
  ])}
)
on conflict (id) do nothing;

${submissionsInsertSQL(expenses.rows)}

-- Data Collection (new): a sample "Customer Feedback" form - the blank-
-- canvas Forms template has no preset fields of its own, so this dataset
-- defines its own. No monetary total (a feedback form doesn't have one) -
-- its "volume" is response count and rating distribution instead.
insert into forms (id, name, description, status, is_demo, user_id, settings, fields)
values (
  ${sqlStr(FEEDBACK_FORM_ID)},
  'Customer Feedback',
  'A sample data-collection form and its responses, used to power the onboarding demo.',
  'published', true, '7d91d04c-d223-4ef1-a94d-382aa2d31bfe', '{}'::jsonb,
  ${sqlJson([
    { id: 'name', type: 'text', label: 'Name', required: false },
    { id: 'email', type: 'email', label: 'Email', required: false },
    { id: 'how_heard', type: 'dropdown', label: 'How did you hear about us?', required: false, options: HOW_HEARD },
    { id: 'rating', type: 'rating', label: 'Rating', required: true, maxStars: 5 },
    { id: 'comments', type: 'longtext', label: 'Comments', required: false },
    { id: 'recommend', type: 'multiplechoice', label: 'Would you recommend us?', required: false, options: ['Yes', 'No'] },
  ])}
)
on conflict (id) do nothing;

${submissionsInsertSQL(feedback.rows)}

-- New demo_datasets rows (Mama's Kitchen's own row from Phase 2 already
-- points at the same, unchanged form id, so it needs no update).
insert into demo_datasets (id, name, form_id) values
  (${sqlStr(RETAIL_DATASET_ID)}, 'Glow Fashion Retail Demo', ${sqlStr(RETAIL_FORM_ID)}),
  (${sqlStr(EXPENSES_DATASET_ID)}, 'Kola & Co Ventures Expenses Demo', ${sqlStr(EXPENSES_FORM_ID)}),
  (${sqlStr(FEEDBACK_DATASET_ID)}, 'Customer Feedback Demo', ${sqlStr(FEEDBACK_FORM_ID)})
on conflict (id) do nothing;

-- Reporting moves off the Restaurant dataset (previously identical to
-- Sales) onto the new Retail one - matches the onboarding design brief's
-- own example pairing (Sales/Restaurant, Reporting/Retail). Expenses and
-- Data Collection move from a field-shape preview to real report data now
-- that there's something to show.
update demo_routes set demo_dataset_id = ${sqlStr(RETAIL_DATASET_ID)}, destination = 'report' where entry_intent = 'reporting';
update demo_routes set demo_dataset_id = ${sqlStr(EXPENSES_DATASET_ID)}, destination = 'report' where entry_intent = 'expenses';
update demo_routes set demo_dataset_id = ${sqlStr(FEEDBACK_DATASET_ID)}, destination = 'report' where entry_intent = 'data_collection';
`

fs.writeFileSync(outPath, sql)
console.log(`\nWrote ${outPath} (${(sql.length / 1024).toFixed(0)} KB)`)
