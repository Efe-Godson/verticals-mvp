// Place at: src/report/DetailedAnalysis.jsx
import FieldReport from './FieldReport'

function DetailedAnalysis({
  fields,
  submissions,
  totalResponses,
  title = 'Detailed Field Analysis',
}) {
  if (!fields || fields.length === 0) return null

  return (
    <section style={{ marginTop: '2.5rem' }}>
      <h2
        style={{
          marginBottom: '1.5rem',
          fontSize: '1.6rem',
          fontWeight: 700,
        }}
      >
        {title}
      </h2>

      {fields.map((field) => (
        <FieldReport
          key={field.id}
          field={field}
          submissions={submissions}
          totalResponses={totalResponses}
        />
      ))}
    </section>
  )
}

export default DetailedAnalysis
