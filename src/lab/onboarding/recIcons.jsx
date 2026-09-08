// Solid, bold, flat icons for the Step 5 recommendation cards - one per
// RECOMMENDATION_CATALOG key (plus `reporting` for the preference line).
// Single-colour (fill: currentColor), 24x24, no strokes. Rendered inside a
// small tinted rounded square.

const ICONS = {
  reports: (
    <>
      <rect x="3" y="12" width="4.5" height="9" rx="1.2" />
      <rect x="9.75" y="6" width="4.5" height="15" rx="1.2" />
      <rect x="16.5" y="3" width="4.5" height="18" rx="1.2" />
    </>
  ),
  'sales-records': (
    <>
      <path d="M6 2h9a2 2 0 0 1 2 2v18l-2.6-1.7L12 22l-2.4-1.7L7 22V4a2 2 0 0 1 2-2z" />
      <rect x="8.5" y="7" width="8" height="2" rx="1" fill="var(--color-primary-soft)" />
      <rect x="8.5" y="11" width="8" height="2" rx="1" fill="var(--color-primary-soft)" />
    </>
  ),
  inventory: (
    <path d="M12 2.2l8.5 4.3v10.9L12 21.8 3.5 17.4V6.5L12 2.2zm0 2.4L6.3 7.4 12 10.3l5.7-2.9L12 4.6zM5 9.2v7l6 3.1v-7L5 9.2zm14 0l-6 3.1v7l6-3.1v-7z" />
  ),
  expenses: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="2.5" />
      <circle cx="12" cy="12" r="3.2" fill="var(--color-primary-soft)" />
      <circle cx="5.5" cy="12" r="1.3" fill="var(--color-primary-soft)" />
      <circle cx="18.5" cy="12" r="1.3" fill="var(--color-primary-soft)" />
    </>
  ),
  customers: (
    <>
      <circle cx="9" cy="8" r="3.4" />
      <path d="M2.8 19.5c0-3.3 2.8-5.6 6.2-5.6s6.2 2.3 6.2 5.6z" />
      <circle cx="17" cy="9" r="2.7" />
      <path d="M15 19.5c0-2.4 1.6-4.3 4-4.3 2.5 0 4 1.9 4 4.3z" />
    </>
  ),
  payroll: (
    <>
      <circle cx="12" cy="8" r="3.8" />
      <path d="M4.5 20.5c0-3.9 3.4-6.5 7.5-6.5s7.5 2.6 7.5 6.5z" />
    </>
  ),
  'scheduled-reports': (
    <>
      <rect x="3" y="4.5" width="18" height="16.5" rx="2.5" />
      <rect x="7" y="1.5" width="2.4" height="5" rx="1.2" />
      <rect x="14.6" y="1.5" width="2.4" height="5" rx="1.2" />
      <rect x="3" y="9" width="18" height="2" fill="var(--color-primary-soft)" />
      <circle cx="8" cy="15" r="1.4" fill="var(--color-primary-soft)" />
      <circle cx="12" cy="15" r="1.4" fill="var(--color-primary-soft)" />
      <circle cx="16" cy="15" r="1.4" fill="var(--color-primary-soft)" />
    </>
  ),
  alerts: (
    <>
      <path d="M12 2.5a6.2 6.2 0 0 0-6.2 6.2c0 4.8-1.9 6-1.9 7.8h16.2c0-1.8-1.9-3-1.9-7.8A6.2 6.2 0 0 0 12 2.5z" />
      <path d="M9.7 19a2.3 2.3 0 0 0 4.6 0z" />
    </>
  ),
  'import-data': (
    <>
      <path d="M10.8 3h2.4v6.2h3.3L12 15l-4.5-5.8h3.3z" />
      <rect x="3.5" y="16.5" width="17" height="4" rx="1.4" />
    </>
  ),
  dashboard: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="1.8" />
      <rect x="13" y="3" width="8" height="8" rx="1.8" />
      <rect x="3" y="13" width="8" height="8" rx="1.8" />
      <rect x="13" y="13" width="8" height="8" rx="1.8" />
    </>
  ),
  'custom-workflow': (
    <>
      <rect x="3" y="3" width="18" height="18" rx="4.5" />
      <path d="M11 7.5h2V11h3.5v2H13v3.5h-2V13H7.5v-2H11z" fill="var(--color-primary-soft)" />
    </>
  ),
  reporting: (
    <>
      <rect x="3" y="4.5" width="18" height="16.5" rx="2.5" />
      <rect x="7" y="1.5" width="2.4" height="5" rx="1.2" />
      <rect x="14.6" y="1.5" width="2.4" height="5" rx="1.2" />
      <rect x="3" y="9" width="18" height="2" fill="var(--color-primary-soft)" />
    </>
  ),
}

export function RecIcon({ name, size = 20 }) {
  return (
    <span
      aria-hidden="true"
      style={{
        flexShrink: 0, width: 38, height: 38, borderRadius: 10,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--color-primary-soft)', color: 'var(--color-primary)',
      }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        {ICONS[name] || ICONS.reports}
      </svg>
    </span>
  )
}
