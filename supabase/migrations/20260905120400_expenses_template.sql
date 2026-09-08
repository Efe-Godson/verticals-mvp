-- Seeds the shared "Expenses" template: a universal "where is my money
-- going?" workflow. A valid expense needs only Amount + Category; every
-- other field is optional and lives behind "+ Add details" in the Quick Add
-- screen (src/expenses/QuickAddExpense.jsx). Created like a location - one
-- normal form per expense book, tagged settings.templateSlug = 'expenses',
-- opening src/expenses/ExpenseOverview.jsx. Records and Reports are the
-- generic engines, unchanged.
insert into templates (slug, name, category, eyebrow, description, highlights, fields)
values (
  'expenses',
  'Expenses',
  'Finance',
  'Track spending',
  'Record, understand and control where your money goes.',
  array[
    'Record an expense in seconds - Amount + Category + Save',
    'Everything else optional under "Add details"',
    'Works for a business or an individual'
  ],
  $tmpl$[
    { "id": "amount", "type": "number", "label": "Amount", "required": true },
    {
      "id": "category", "type": "dropdown", "label": "Category", "required": true,
      "options": [
        "Inventory / Stock", "Supplies", "Transport", "Utilities", "Rent",
        "Staff", "Marketing", "Repairs & Maintenance", "Equipment",
        "Software & Subscriptions", "Professional Services", "Taxes / Fees",
        "Food / Entertainment", "Bank Charges", "Other"
      ]
    },
    { "id": "description", "type": "text", "label": "Description", "required": false },
    { "id": "date", "type": "date", "label": "Date", "required": false },
    { "id": "time", "type": "time", "label": "Time", "required": false },
    {
      "id": "payment_method", "type": "dropdown", "label": "Payment method", "required": false,
      "options": ["Cash", "Bank Transfer", "Card", "POS", "Mobile Wallet", "Other"]
    },
    {
      "id": "paid_from", "type": "dropdown", "label": "Paid from", "required": false,
      "options": ["Business account", "Cash / Till", "Personal account", "Other"]
    },
    { "id": "vendor", "type": "text", "label": "Vendor / Supplier", "required": false },
    { "id": "location", "type": "text", "label": "Location", "required": false },
    { "id": "notes", "type": "longtext", "label": "Notes", "required": false },
    { "id": "receipt", "type": "fileupload", "label": "Receipt", "required": false, "acceptTypes": ".jpg,.jpeg,.png,.pdf" }
  ]$tmpl$::jsonb
)
on conflict (slug) do nothing;
