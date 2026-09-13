// Place at: src/lab/TrustLegalManagerPage.jsx
// Lab -> Trust & Legal (/lab/trust-legal, brief sections 4-5). Tab shell
// over the 7 sub-sections; each tab is either LegalPageEditor (the 5 fixed
// pages), SubprocessorsEditor, or ResourcesManager.
import { useState } from 'react'
import LabSidePanel from '../LabSidePanel'
import { usePageBack } from '../PageTitleContext'
import LegalPageEditor from './trustLegal/LegalPageEditor'
import SubprocessorsEditor from './trustLegal/SubprocessorsEditor'
import ResourcesManager from './trustLegal/ResourcesManager'

const TABS = [
  { id: 'trust', label: 'Trust Center' },
  { id: 'security', label: 'Security' },
  { id: 'privacy', label: 'Privacy Policy' },
  { id: 'terms', label: 'Terms of Service' },
  { id: 'cookies', label: 'Cookie Policy' },
  { id: 'subprocessors', label: 'Subprocessors' },
  { id: 'resources', label: 'Resources' },
]

export default function TrustLegalManagerPage() {
  usePageBack('/lab', 'Lab')
  const [activeTab, setActiveTab] = useState('trust')

  return (
    <div className="page">
      <LabSidePanel />
      <h1 style={{ marginBottom: '0.3rem' }}>Trust & Legal</h1>
      <p style={{ color: 'var(--color-muted)', marginTop: 0, marginBottom: '1.5rem' }}>
        Paste content, preview it, then publish - the public /trust, /security, /privacy, /terms, /cookies,
        /subprocessors and /resources pages read whatever's currently published here.
      </p>

      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.8rem' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? '' : 'secondary'}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: '1.3rem' }}>
        {activeTab === 'trust' && <LegalPageEditor slug="trust" label="Trust Center" />}
        {activeTab === 'security' && <LegalPageEditor slug="security" label="Security" />}
        {activeTab === 'privacy' && <LegalPageEditor slug="privacy" label="Privacy Policy" />}
        {activeTab === 'terms' && <LegalPageEditor slug="terms" label="Terms of Service" />}
        {activeTab === 'cookies' && <LegalPageEditor slug="cookies" label="Cookie Policy" />}
        {activeTab === 'subprocessors' && <SubprocessorsEditor />}
        {activeTab === 'resources' && <ResourcesManager />}
      </div>
    </div>
  )
}
