// Drop-in replacement for a full-page <LoadingState /> spinner (Universal
// Loading States brief §2, §4): a structured placeholder that keeps the
// page feeling like it's already there. Pick the `variant` that matches
// what the page renders once loaded.
//
//   const skel = useDeferredLoading(loading)
//   if (loading) return skel ? <PageSkeleton variant="table" /> : null
//
// It renders inside the normal .page column; the app shell / sidebar /
// navbar around it stay put (they're not part of this).
import { Skeleton, SkeletonText, SkeletonCard, SkeletonKpis, SkeletonTableRows, SkeletonChart } from './Skeleton'

function TitleRow({ toolbar = true }) {
  return (
    <>
      <Skeleton w="34%" h="1.6rem" style={{ marginBottom: toolbar ? '1.1rem' : '1.5rem' }} />
      {toolbar && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.4rem' }}>
          <Skeleton w="220px" h="38px" />
          <Skeleton w="130px" h="38px" />
          <Skeleton w="110px" h="38px" style={{ marginLeft: 'auto' }} />
        </div>
      )}
    </>
  )
}

function TableSkel({ cols = 5, rows = 8 }) {
  return (
    <div className="table-wrap" aria-hidden="true">
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} style={{ padding: '0.6rem 0.7rem', borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                <Skeleton w="60%" h="0.7rem" />
              </th>
            ))}
          </tr>
        </thead>
        <SkeletonTableRows rows={rows} cols={cols} />
      </table>
    </div>
  )
}

export default function PageSkeleton({ variant = 'table', toolbar = true, style }) {
  return (
    <div className="page" style={style} aria-busy="true">
      <TitleRow toolbar={toolbar && variant !== 'detail' && variant !== 'form'} />

      {variant === 'table' && <TableSkel />}

      {variant === 'cards' && (
        <div className="grid-auto" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} lines={2} />)}
        </div>
      )}

      {variant === 'kpis' && (
        <>
          <SkeletonKpis count={4} className="kpi-grid" />
          <div style={{ height: '1.2rem' }} />
          <SkeletonChart />
        </>
      )}

      {variant === 'report' && (
        <>
          <SkeletonKpis count={4} className="kpi-grid" />
          <div style={{ height: '1.2rem' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <SkeletonChart />
            <SkeletonChart />
          </div>
        </>
      )}

      {variant === 'detail' && (
        <>
          <Skeleton w="45%" h="1.5rem" style={{ marginBottom: '0.4rem' }} />
          <Skeleton w="28%" h="0.85rem" style={{ marginBottom: '1.5rem' }} />
          <SkeletonCard lines={3} style={{ marginBottom: '1rem' }} />
          <SkeletonCard lines={4} />
        </>
      )}

      {variant === 'form' && (
        <>
          <Skeleton w="40%" h="1.5rem" style={{ marginBottom: '1.5rem' }} />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ marginBottom: '1.1rem' }}>
              <Skeleton w="30%" h="0.7rem" style={{ marginBottom: '0.4rem' }} />
              <Skeleton w="100%" h="38px" />
            </div>
          ))}
        </>
      )}
    </div>
  )
}

// Body-only skeleton for a modal that shouldn't unmount while its data
// loads (brief §5). Labelled rows, matching the usual field layout.
export function ModalBodySkeleton({ rows = 4 }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ marginBottom: '1rem' }}>
          <Skeleton w="28%" h="0.7rem" style={{ marginBottom: '0.4rem' }} />
          <Skeleton w={['70%', '90%', '55%', '80%'][i % 4]} h="1rem" />
        </div>
      ))}
    </div>
  )
}

export { SkeletonText }
