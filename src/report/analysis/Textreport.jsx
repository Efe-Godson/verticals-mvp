import ExpandableList from '../components/ExpandableList'

function TextReport({ field, answered, completionRate, totalResponses, skipList }) {
  return (
    <div style={{ marginTop: '0.8rem' }}>
      <p style={{ color: '#666', fontSize: '0.9rem' }}>
        {answered.length} of {totalResponses} responses ({completionRate}% completion rate)
      </p>
      {skipList ? null : answered.length === 0 ? (
        <p style={{ color: '#999' }}>No responses yet.</p>
      ) : (
        <div style={{ border: '1px solid #eee', borderRadius: '6px', padding: '0.8rem', marginTop: '0.5rem' }}>
          <ExpandableList
            items={answered}
            renderItem={(s) => (
              <div key={s.id} style={{
                padding: '0.5rem 0',
                borderBottom: '1px solid #f0f0f0'
              }}>
                {s.data[field.id]}
              </div>
            )}
          />
        </div>
      )}
    </div>
  )
}

export default TextReport