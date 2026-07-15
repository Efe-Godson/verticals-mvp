// Place at: src/report/FieldReport.jsx
import NumberReport from './analysis/Numberreport'
import CategoryReport from './analysis/Categoryreport'
import DateReport from './analysis/Datereport'
import TextReport from './analysis/Textreport'
import CartReport from './analysis/Cartreport'

function FieldReport({ field, submissions, totalResponses }) {
  const answered = submissions.filter((s) => {
    const value = s.data?.[field.id]

    if (value === null || value === undefined) return false

    if (field.type === 'multiplechoicegrid' || field.type === 'checkboxgrid') {
      return value && typeof value === 'object' && Object.keys(value).length > 0
    }

    if (typeof value === 'string') return value.trim() !== ''

    if (Array.isArray(value)) return value.length > 0

    return true
  })

  const completionRate =
    totalResponses > 0
      ? Math.round((answered.length / totalResponses) * 100)
      : 0

  function renderReport() {
    switch (field.type) {
      // Numbers
      case 'number':
      case 'rating':
      case 'linearscale':
        return (
          <NumberReport
            field={field}
            answered={answered}
          />
        )

      // Categories
      case 'dropdown':
      case 'multiplechoice':
        return (
          <CategoryReport
            field={field}
            answered={answered}
            totalResponses={totalResponses}
          />
        )

      case 'checkbox':
        return (
          <CategoryReport
            field={field}
            answered={answered}
            totalResponses={totalResponses}
            multi
          />
        )

      // Dates
      case 'date':
        return (
          <DateReport
            field={field}
            answered={answered}
          />
        )

      // Fields where we only ever show a response/completion rate — no
      // listing of the actual answers.
      case 'text':
      case 'longtext':
      case 'email':
      case 'phone':
      case 'multiplechoicegrid':
      case 'checkboxgrid':
      case 'fileupload':
      case 'time':
        return (
          <TextReport
            field={field}
            answered={answered}
            totalResponses={totalResponses}
            completionRate={completionRate}
            skipList
          />
        )

      // Cart
      case 'cart':
        return (
          <CartReport
            field={field}
            answered={answered}
          />
        )

      default:
        return (
          <p style={{ color: '#999' }}>
            Reporting is not yet supported for the "{field.type}" field type.
          </p>
        )
    }
  }

  return (
    <div className="card" style={{ padding: '1.75rem', marginBottom: '2rem', overflow: 'hidden' }}>
      <div
        style={{
          paddingBottom: '1rem',
          marginBottom: '1rem',
          borderBottom: '1px solid #eee',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: '1.1rem',
            fontWeight: 700,
          }}
        >
          {field.label}
        </h3>

        <p
          style={{
            marginTop: '0.35rem',
            color: '#666',
            fontSize: '0.9rem',
          }}
        >
          {field.type} • {answered.length} of {totalResponses} responses completed
        </p>
      </div>

      {renderReport()}
    </div>
  )
}

export default FieldReport
