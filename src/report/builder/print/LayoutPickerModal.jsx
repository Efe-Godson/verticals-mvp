// Place at: src/report/builder/print/LayoutPickerModal.jsx
// Visual "+ Add page" picker (Designer batch 1) - a grid of schematic
// PageThumbnail-style cards, one per pageLayouts.js entry, replacing the
// old plain <select>. Picking a card creates the new page with that
// layout's elements; PrintWorkspace.jsx keeps owning the actual insertion
// call (blank -> addPrintPage, else -> addPrintPageWithElements) via onPick.
import Modal from '../../../components/Modal'
import PageThumbnail from './PageThumbnail'
import { PAGE_LAYOUTS } from './pageLayouts'

export default function LayoutPickerModal({ open, onClose, onPick, pageSize, orientation }) {
  return (
    <Modal open={open} onClose={onClose} title="Add page" size="lg">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.9rem' }}>
        {PAGE_LAYOUTS.map(layout => {
          const previewPage = { elements: layout.make().map((el, i) => ({ ...el, id: `preview-${i}` })) }
          return (
            <button
              key={layout.id}
              className="secondary"
              onClick={() => { onPick(layout.id); onClose() }}
              style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '0.5rem', alignItems: 'stretch', textAlign: 'left' }}
            >
              <PageThumbnail page={previewPage} pageSize={pageSize} orientation={orientation} />
              <span style={{ fontSize: '0.8rem' }}>{layout.label}</span>
            </button>
          )
        })}
      </div>
    </Modal>
  )
}
