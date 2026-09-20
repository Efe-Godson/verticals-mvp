// Place at: src/report/builder/print/elements/DateRangeElement.jsx
// Renders a 'date-range' element (elementModel.js's makeDateRangeElement) -
// a small floating pill showing the report's period, computed fresh at
// render time from the same DATE_RANGE_OPTIONS/getDateRangeBounds every
// other date filter in the app uses (src/report/helpers/dateRange.js), so
// it can't drift from what "This month"/"Last 3 months"/etc. mean elsewhere.
// exportPptx.js computes the identical string via the same
// formatDateRangeDisplay() rather than re-rendering this component, since
// PPTX text goes in as a native text box, not a screenshot.
import { formatDateRangeDisplay } from '../../../helpers/dateRange'

export default function DateRangeElement({ element }) {
  const label = formatDateRangeDisplay(element.preset, element.customStart, element.customEnd, element.format)
  return (
    <div style={{
      height: '100%', display: 'flex', alignItems: 'center',
      justifyContent: element.align === 'left' ? 'flex-start' : element.align === 'right' ? 'flex-end' : 'center',
      border: `1px solid ${element.stroke || '#cbd5e1'}`, borderRadius: '999px', background: element.fill || '#ffffff',
      fontSize: element.fontSize ? `${element.fontSize}px` : '14px', fontWeight: element.bold ? 700 : 400,
      fontFamily: element.fontFamily || 'inherit', color: element.color || '#334155',
      padding: '0 0.9rem', boxSizing: 'border-box', overflow: 'hidden', whiteSpace: 'nowrap',
    }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
    </div>
  )
}
