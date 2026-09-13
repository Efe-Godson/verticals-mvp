// Shared with both the page components (SalesTrackingPage.jsx,
// ExpenseTrackingPage.jsx - the visible <details> Q&A block) and
// scripts/prerender.mjs (the matching FAQPage JSON-LD baked into the static
// HTML for crawlers that don't execute JS) - one copy so the visible text
// and the structured data describing it can't drift apart.
export const SMALL_BUSINESS_FAQS = [
  {
    q: 'What can a small business track with Verticals?',
    a: 'Sales, expenses, inventory and staff payments are the most common - each as its own form, with records and reports that work the same way regardless of what you track.',
  },
  {
    q: 'Do I need separate tools for sales, expenses and staff payments?',
    a: "No. Each is a workflow inside the same account - its own form, its own records, its own reports - so everything lives in one place instead of several disconnected tools.",
  },
  {
    q: 'Do I need technical or accounting experience to use it?',
    a: "No. Forms are built by adding the fields you need, and reports are generated automatically from your records - no spreadsheet formulas or data analysis skills required.",
  },
]

export const RESTAURANT_FAQS = [
  {
    q: 'Can staff take orders without full account access?',
    a: 'Yes. A staff account can be limited to just the order screen, records and reports for one form, so a cashier can take orders without seeing the rest of the business.',
  },
  {
    q: 'Can I print a receipt for each order?',
    a: "Yes. Orders taken through a restaurant-style form can print a receipt directly, the same way a till would.",
  },
  {
    q: 'Can I track which menu items sell best?',
    a: 'Yes. Once orders are recorded with the items and quantities sold, reports show your best-selling items and sales trends automatically.',
  },
]

export const RETAIL_FAQS = [
  {
    q: 'Can I generate an invoice for a sale?',
    a: 'Yes. A retail-style order form can generate a downloadable invoice for a sale, not just a receipt.',
  },
  {
    q: 'Can I track which products sell best?',
    a: 'Yes. Sales recorded with product and quantity roll up into reports showing your best and slowest-selling products automatically.',
  },
  {
    q: 'Can I track stock or inventory alongside sales?',
    a: "Yes. Inventory can be tracked alongside your sales records, so stock levels and sales performance sit in the same place.",
  },
]

export const TEMPLATES_FAQS = [
  {
    q: 'Can I start from a template instead of building a form from scratch?',
    a: 'Yes. Retail, Restaurant and Expenses templates come with the fields and workflow already set up - pick one and start recording right away.',
  },
  {
    q: 'Can I customize a template after starting?',
    a: "Yes. A template is a starting point, not a fixed structure - fields can still be adjusted once you've started using it.",
  },
  {
    q: "What if none of the templates fit my business?",
    a: 'The Forms template starts from a blank canvas - add exactly the fields you need with no preset catalogue or workflow.',
  },
]

export const SALES_TRACKING_FAQS = [
  {
    q: 'How can I track daily sales?',
    a: 'Build a simple sales form once - what you sell, quantity, price, date, location - and every sale you record from then on becomes a structured record automatically, no spreadsheet required.',
  },
  {
    q: 'How can I see my best-selling products?',
    a: "Verticals totals your sales records by product automatically, so your top sellers, slowest movers and everything in between show up in a report without you calculating anything by hand.",
  },
  {
    q: 'How can I monitor sales performance over time?',
    a: 'Reports compare sales across the date ranges you choose - day over day, week over week, or a custom range - so trends are visible instead of buried across separate records.',
  },
  {
    q: 'Can I compare products or locations against each other?',
    a: 'Yes. Once sales are recorded with a product and (if relevant) a location attached, reports can break totals down by either, so you can see what sells where.',
  },
]

export const FORMS_FAQS = [
  {
    q: 'Can I build my own form?',
    a: 'Yes. Add exactly the fields you need - text, numbers, dates, product/quantity fields for order-style forms, locations and more - and organise them into sections or one-question-per-screen pages.',
  },
  {
    q: 'Can I share a form for others to fill in without an account?',
    a: "Yes. A published form gets a public link anyone can open and submit - no Verticals account required on their end.",
  },
  {
    q: 'Can a form include product or item selection, like an order form?',
    a: 'Yes. Product and quantity fields let a form work like an order screen, with amounts calculated automatically as items are selected.',
  },
  {
    q: 'Is a Verticals form mobile friendly?',
    a: 'Yes. Forms are built to be filled in from a phone as easily as a desktop, since most day-to-day submissions happen on the go.',
  },
]

export const RECORDS_FAQS = [
  {
    q: 'Can I search and filter my records?',
    a: 'Yes. Records collected through a form can be searched, filtered and sorted, so finding a specific submission or a subset of them takes seconds.',
  },
  {
    q: 'Can I export my records?',
    a: 'Yes. Records can be exported as PDF, Excel or CSV whenever you need them outside Verticals.',
  },
  {
    q: 'Can multiple people submit to the same form?',
    a: "Yes. A public form can collect submissions from anyone with the link, and every submission becomes its own organised record automatically.",
  },
]

export const REPORTS_FAQS = [
  {
    q: 'How do I create a report from my records?',
    a: 'Reports are generated from the records a form has already collected - totals, trends and breakdowns are worked out automatically, nothing to set up by hand.',
  },
  {
    q: 'Can I compare performance across time periods?',
    a: 'Yes. Reports can compare any date range against another, so you can see whether a metric is trending up or down over time.',
  },
  {
    q: 'Can I ask questions about my data instead of building charts myself?',
    a: 'Yes. An AI-assisted analyst can answer plain-language questions about your records, like which product to restock first or what changed since last period.',
  },
  {
    q: 'Can I export or print a report?',
    a: 'Yes. Reports can be exported as PDF or PowerPoint, or printed directly.',
  },
]

export const INVENTORY_FAQS = [
  {
    q: 'How do I track stock levels?',
    a: 'Each product in a form\'s catalogue carries its own stock quantity, updated as you restock or as sales record how much was sold.',
  },
  {
    q: 'Can I get a low-stock warning?',
    a: 'Yes. Products below a low-stock threshold are flagged automatically, so restocking decisions don\'t depend on manually checking every item.',
  },
  {
    q: 'Can I do a full stocktake and reset counts?',
    a: "Yes. Instead of only adding stock, you can set an exact count for a product - useful right after a physical stocktake.",
  },
]

export const PAYROLL_FAQS = [
  {
    q: 'What can I record for staff payments?',
    a: 'Base salary, plus additions like bonuses, allowances, reimbursements and commission, and deductions like fines, missed days, salary advances and loan repayments.',
  },
  {
    q: 'How is a final payment amount calculated?',
    a: 'The final amount is the monthly salary plus total additions minus total deductions - worked out automatically from whatever entries were recorded for that staff member.',
  },
  {
    q: 'Can I record a one-off deduction like a missed day or a fine?',
    a: 'Yes. Deductions and additions are recorded as individual entries against a staff member, and roll up into that month\'s payroll automatically.',
  },
]

export const EXPENSE_TRACKING_FAQS = [
  {
    q: 'How can I track business expenses?',
    a: 'Record each expense as it happens - amount, category, date, payment method - through a simple form, instead of collecting receipts to sort through later.',
  },
  {
    q: 'Can I track recurring expenses like rent or subscriptions?',
    a: "Yes. Recurring expenses are recorded the same way as any other expense record, so they show up in your totals and category breakdowns alongside everything else.",
  },
  {
    q: 'How do I know where my money is going?',
    a: 'Expense reports group your records by category so spending patterns - what you spend most on, and how that changes over time - are visible without adding anything up yourself.',
  },
  {
    q: 'Can I create an expense report for a specific period?',
    a: 'Yes. Reports can be filtered to any date range, so you can review a week, a month or a custom period on its own.',
  },
]
