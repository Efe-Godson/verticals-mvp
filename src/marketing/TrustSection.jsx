import { Lock, Download, ShieldCheck } from 'lucide-react'
import ScrollReveal from './ScrollReveal'

const ITEMS = [
  {
    icon: Lock,
    title: 'Private by design',
    desc: "Your data is your property, full stop. Verticals is built with GDPR and NDPA compliance in mind, and your workspace stays private unless you choose to share it.",
  },
  {
    icon: Download,
    title: 'Export when you need to',
    desc: 'Your data is never locked in. Download your records and reports as PDF, Excel or PowerPoint whenever you need them.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure access',
    desc: 'Your workspace is protected by authenticated access, so only you and the people you give access to can get in.',
  },
]

export default function TrustSection() {
  return (
    <section className="mkt-section">
      <div className="mkt-container">
        <div className="mkt-trust-wrap">
          <h2 className="mkt-heading mkt-trust-heading">Your information stays yours.</h2>
          <ScrollReveal className="mkt-trust-list">
            {ITEMS.map(({ icon: Icon, title, desc }) => (
              <div className="mkt-trust-item" key={title}>
                <p className="mkt-trust-title">
                  <span className="mkt-trust-icon"><Icon size={21} strokeWidth={2} /></span>
                  {title}
                </p>
                <p className="mkt-trust-desc">{desc}</p>
              </div>
            ))}
          </ScrollReveal>
        </div>
      </div>
    </section>
  )
}
