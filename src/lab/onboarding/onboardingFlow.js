// The pre-signup onboarding flow (v4), on the shared Conditional Flow Engine
// (src/flow). Lab prototype only - nothing here writes to Supabase or
// touches signup.
//
// Sells the outcome of Verticals while quietly collecting enough to
// personalise the setup and learn what customers want built next.
//
// 1. What matters to you?        interests + primary + (custom name/goal)
// 2. How do you work today?      tracking methods + app + frequency
// 3. How should Verticals help?  outcomes + report frequency
// 4. What are we setting up?     business or workflow
// 5. Your Verticals setup        no questions - the payoff

const interest = (v) => ({ field: 'interests', op: 'includes', value: v })
const anyInterest = (...vs) => ({ any: vs.map(interest) })
const outcome = (v) => ({ field: 'desired_outcomes', op: 'includes', value: v })

export const onboardingFlow = {
  id: 'onboarding-v4',

  steps: [
    // --------------------------------------------------------------- 1
    {
      id: 'interests',
      eyebrow: 'Step 1 of 5',
      title: "Choose everything you'd like to understand better",
      note: 'Takes about a minute.',
      ctaLabel: 'Continue →',
      fields: [
        {
          id: 'interests',
          type: 'multiselect',
          required: true,
          options: [
            { value: 'sales', label: 'Sales', help: "Know what's selling and how sales are moving." },
            { value: 'money', label: 'Money', help: "Understand what's coming in, what's going out and where your money goes." },
            { value: 'inventory', label: 'Inventory', help: "Know what's moving, what's available and what's running low." },
            { value: 'customers', label: 'Customers', help: 'Understand your customers and their activity.' },
            { value: 'staff', label: 'Staff', help: 'Keep track of staff activity, attendance and payments.' },
            { value: 'custom', label: 'Something else', help: 'Tell us about something specific you want to track or understand.' },
          ],
        },
        {
          id: 'custom_interest_name',
          type: 'text',
          label: 'What would you like to track or understand?',
          help: 'Tell us what you wish Verticals could help you keep track of.',
          placeholder: 'e.g. Deliveries, bookings, projects, suppliers...',
          visibleWhen: interest('custom'),
        },
        {
          id: 'custom_interest_goal',
          type: 'text',
          label: 'What would you like to know about it?',
          placeholder: 'e.g. Which deliveries take longest to complete?',
          visibleWhen: interest('custom'),
        },
        {
          id: 'primary_interest',
          type: 'single',
          label: 'What should we focus on first?',
          help: "You can keep an eye on everything you've selected. What matters most right now?",
          visibleWhen: { field: 'interests', op: 'countGte', value: 2 },
          optionsFrom: { field: 'interests' },
        },
      ],
    },

    // --------------------------------------------------------------- 2
    {
      id: 'current-system',
      eyebrow: 'Step 2 of 5',
      title: 'How do you keep track today?',
      description: "Tell us what you're already working with.",
      ctaLabel: 'Continue →',
      fields: [
        {
          id: 'current_tracking_methods',
          type: 'multiselect',
          required: true,
          exclusiveValue: 'none',
          options: [
            { value: 'notebook', label: 'Notebook / paper' },
            { value: 'sheets', label: 'Excel / Google Sheets' },
            { value: 'whatsapp', label: 'WhatsApp' },
            { value: 'app', label: 'Another app' },
            { value: 'memory', label: 'Mostly from memory' },
            { value: 'none', label: "I don't track it yet" },
          ],
        },
        {
          id: 'current_app',
          type: 'text',
          label: 'What do you use?',
          placeholder: 'App / software name',
          visibleWhen: { field: 'current_tracking_methods', op: 'includes', value: 'app' },
        },
        {
          id: 'recording_frequency',
          type: 'single',
          label: 'How often do you record things?',
          required: true,
          options: [
            { value: 'as_it_happens', label: 'As they happen' },
            { value: 'daily', label: 'Daily' },
            { value: 'weekly', label: 'Weekly' },
            { value: 'when_remember', label: 'Whenever I remember' },
          ],
        },
      ],
    },

    // --------------------------------------------------------------- 3
    {
      id: 'desired-help',
      eyebrow: 'Step 3 of 5',
      title: 'What would make Verticals most useful to you?',
      description: 'Choose up to 3.',
      ctaLabel: 'Continue →',
      fields: [
        {
          id: 'desired_outcomes',
          type: 'multiselect',
          required: true,
          maxSelect: 3,
          // The specific options are gated on Step 1's interests (option-level
          // visibleWhen), so someone who picked Sales sees "top-selling
          // product" while someone who picked Inventory sees "what's running
          // low". The last three always show.
          options: [
            { value: 'sales_top_product', label: 'See my top-selling product', visibleWhen: interest('sales') },
            { value: 'sales_best_times', label: 'See my best days and busiest times', visibleWhen: interest('sales') },
            { value: 'sales_trend', label: 'Know if sales are going up or down', visibleWhen: interest('sales') },

            { value: 'money_top_expenses', label: 'See my biggest expenses', visibleWhen: interest('money') },
            { value: 'money_rising_costs', label: 'Spot costs that are creeping up', visibleWhen: interest('money') },

            { value: 'inv_low_stock', label: "See what's running low", visibleWhen: interest('inventory') },
            { value: 'inv_fast_movers', label: "See what's selling fastest", visibleWhen: interest('inventory') },

            { value: 'cust_best', label: 'See my best customers', visibleWhen: interest('customers') },
            { value: 'cust_repeat', label: 'See who keeps coming back', visibleWhen: interest('customers') },

            { value: 'staff_attendance', label: 'See attendance and hours', visibleWhen: interest('staff') },
            { value: 'staff_owed', label: 'See what each person is owed', visibleWhen: interest('staff') },

            { value: 'custom_clarity', label: 'Turn my records into clear numbers', visibleWhen: interest('custom') },

            { value: 'auto_reports', label: 'Get automatic updates' },
            { value: 'spot_problems', label: 'Spot problems early' },
            { value: 'one_place', label: 'Have everything in one place' },
          ],
        },
        {
          id: 'preferred_report_frequency',
          type: 'single',
          required: true,
          label: 'How often would you like to know how things are going?',
          options: [
            { value: 'live', label: 'Live' },
            { value: 'few_hours', label: 'Every few hours' },
            { value: 'daily', label: 'Daily' },
            { value: 'weekly', label: 'Weekly' },
            { value: 'monthly', label: 'Monthly' },
            { value: 'on_check', label: 'Only when I check' },
          ],
        },
      ],
    },

    // --------------------------------------------------------------- 4
    {
      id: 'workspace',
      eyebrow: 'Step 4 of 5',
      title: "Let's make this yours",
      ctaLabel: 'Show me my setup →',
      fields: [
        {
          id: 'setup_type',
          type: 'single',
          label: 'What are you setting up?',
          required: true,
          options: [
            { value: 'business', label: 'A business' },
            { value: 'workflow', label: 'A workflow / process' },
          ],
        },
        {
          id: 'business_name',
          type: 'text',
          label: 'What should we call your business?',
          placeholder: 'Business name',
          visibleWhen: { field: 'setup_type', op: 'eq', value: 'business' },
        },
        {
          id: 'business_type',
          type: 'single',
          label: 'What kind of business is it?',
          visibleWhen: { field: 'setup_type', op: 'eq', value: 'business' },
          options: [
            { value: 'food', label: 'Food / Restaurant' },
            { value: 'retail', label: 'Retail' },
            { value: 'services', label: 'Services' },
            { value: 'fashion_beauty', label: 'Fashion / Beauty' },
            { value: 'education', label: 'Education' },
            { value: 'hospitality', label: 'Hospitality' },
            { value: 'other', label: 'Other' },
          ],
        },
        {
          id: 'custom_business_type',
          type: 'text',
          label: 'Tell us what kind of business',
          placeholder: 'e.g. auto repair, farming, events...',
          visibleWhen: {
            all: [
              { field: 'setup_type', op: 'eq', value: 'business' },
              { field: 'business_type', op: 'eq', value: 'other' },
            ],
          },
        },
        {
          id: 'workflow_template',
          type: 'multiselect',
          label: 'Which of these do you want to set up?',
          help: 'Pick as many as apply - each becomes a ready-made workflow you can shape once you are in.',
          visibleWhen: { field: 'setup_type', op: 'eq', value: 'workflow' },
          options: [
            { value: 'sales', label: 'Sales & Orders' },
            { value: 'expenses', label: 'Expenses' },
            { value: 'inventory', label: 'Inventory' },
            { value: 'staff', label: 'Staff & Attendance' },
            { value: 'customers', label: 'Customers' },
            { value: 'deliveries', label: 'Deliveries' },
            { value: 'bookings', label: 'Bookings & Appointments' },
            { value: 'projects', label: 'Projects' },
            { value: 'suppliers', label: 'Suppliers' },
            { value: 'custom', label: 'Something else' },
          ],
        },
        {
          id: 'workflow_name',
          type: 'text',
          label: 'What should we call it?',
          placeholder: 'Workflow name',
          visibleWhen: {
            all: [
              { field: 'setup_type', op: 'eq', value: 'workflow' },
              { field: 'workflow_template', op: 'includes', value: 'custom' },
            ],
          },
        },
        {
          id: 'has_multiple_workspaces',
          type: 'single',
          label: 'Will you eventually want to manage more than one business or workflow here?',
          options: [
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
            { value: 'maybe', label: 'Maybe later' },
          ],
        },
      ],
    },

    // --------------------------------------------------------------- 5
    {
      id: 'result',
      eyebrow: 'Step 5 of 5',
      title: 'Your Verticals setup',
      description: 'Built around what matters to you.',
      ctaLabel: 'Get my Verticals setup →',
      fields: [],
    },
  ],

  // Internal feature mapping (never shown to the customer - see
  // recommendations.js for the outcome-worded cards). Same engine as
  // `visibleWhen`: a feature is an action with a condition.
  actions: [
    { when: interest('sales'), recommend: 'sales-records-reports' },
    { when: interest('money'), recommend: 'expenses-financial-reports' },
    { when: interest('inventory'), recommend: 'inventory-records-reports' },
    { when: interest('customers'), recommend: 'customer-records-reports' },
    { when: interest('staff'), recommend: 'staff-payroll-reports' },
    { when: interest('custom'), recommend: 'custom-form-records-reports' },
    { when: anyInterest('sales', 'money', 'inventory', 'customers', 'staff', 'custom'), recommend: 'reports' },
    { when: outcome('auto_reports'), recommend: 'scheduled-reports' },
    { when: outcome('spot_problems'), recommend: 'alerts' },
    { when: { field: 'current_tracking_methods', op: 'includes', value: 'sheets' }, recommend: 'data-import' },
  ],
}
