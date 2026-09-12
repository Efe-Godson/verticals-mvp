import { Plus } from 'lucide-react'
import ScrollReveal from './ScrollReveal'

const FAQS = [
  {
    q: 'What can I use Verticals for?',
    a: 'Anything you want to keep track of and understand: sales, expenses, inventory, staff, projects, learning progress or a workflow entirely your own.',
  },
  {
    q: 'Can I create my own workflow?',
    a: "Yes. Build a form around exactly what you need to record, and Verticals turns it into organised records and reports automatically.",
  },
  {
    q: 'Do I need to know Excel or data analysis?',
    a: "No. Verticals turns your records into reports for you automatically, with totals, trends and comparisons already worked out.",
  },
  {
    q: 'Can I use more than one workflow?',
    a: 'Yes. Track sales, expenses, projects or anything else side by side in the same account.',
  },
  {
    q: 'Can I try Verticals without creating an account?',
    a: "Yes. Try a free demo with sample data for whatever you're looking to track. No account, no setup.",
  },
  {
    q: 'Is my information private?',
    a: "Yes. Your workspace isn't publicly accessible unless you intentionally share something, and accounts require authenticated access.",
  },
  {
    q: 'Is Verticals GDPR and NDPA compliant?',
    a: "Yes. Verticals is built with both the GDPR (General Data Protection Regulation) and the NDPA (Nigeria Data Protection Act) in mind, covering how your data is collected, stored and processed. You stay in control of your data at all times: it's never sold or shared with third parties, you can export it whenever you like, and you can request deletion of your account and its data.",
  },
]

export default function FAQSection() {
  return (
    <section className="mkt-section" id="faq">
      <div className="mkt-container">
        <div className="mkt-faq">
          <h2 className="mkt-heading" style={{ textAlign: 'left', marginBottom: 'var(--mkt-sp-3)' }}>FAQ</h2>
          <ScrollReveal>
            {FAQS.map(({ q, a }) => (
              <details className="mkt-faq-item" key={q}>
                <summary>
                  {q}
                  <Plus size={18} className="mkt-faq-icon" aria-hidden="true" />
                </summary>
                <p className="mkt-faq-answer">{a}</p>
              </details>
            ))}
          </ScrollReveal>
        </div>
      </div>
    </section>
  )
}
