import { SpinCard } from './SpinCard'
import { scrollToElement } from '../../smoothScroll'
import './pricing.css'

const MONTHLY = ['Fast delivery', "You're the only priority", 'Fast turnaround', 'Multiple requests', 'Weekly meetings', 'Pause or cancel anytime']
const SINGLE = ['Fast delivery', 'Quick updates', 'Customized package', 'Free consultation']
const PERKS = ['Flexible pricing', 'Customised consultation', 'Fast delivery', 'Dedicated support']

const Tick = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 8.5 6.5 12 13 4.5" />
  </svg>
)

/** Pricing: the two ways to work together, after the pricing block on the Framer site. */
export function PricingSection() {
  const toContact = () => {
    const el = document.getElementById('contact')
    if (el) scrollToElement(el, window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }
  return (
    <section className="pricing" id="pricing" aria-labelledby="pc-heading">
      <div className="pc-intro">
        <span className="pc-eyebrow">( pricing )</span>
        <h2 className="pc-heading" id="pc-heading">
          Pick your <em>pace</em>
        </h2>
        <ul className="pc-perks">
          {PERKS.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>

      <div className="pc-frame">
        <article className="pc-hire">
          <SpinCard />
          <span className="pc-available">
            <i aria-hidden="true" /> Available right now
          </span>
          <h3 className="pc-title">Hire me today</h3>
          <p className="pc-text">Skip the agency markup and work directly with an experienced designer.</p>
        </article>

        <article className="pc-monthly">
          <h3 className="pc-title">Monthly Package</h3>
          <p className="pc-text">One flat monthly rate for unlimited design requests. Ideal for ongoing design requirements.</p>
          <hr />
          <p className="pc-price">
            <span>$2,500</span> /month
          </p>
          <ul className="pc-list">
            {MONTHLY.map((f) => (
              <li key={f}>
                <Tick />
                {f}
              </li>
            ))}
          </ul>
          <button type="button" className="pc-btn pc-btn-dark" onClick={toContact}>
            Get Started
          </button>
        </article>

        <article className="pc-single">
          <div>
            <h3 className="pc-title">Single Project</h3>
            <p className="pc-text">Comprehensive design services for any project scope. Ideal for one-time design needs or individual tasks.</p>
          </div>
          <ul className="pc-list">
            {SINGLE.map((f) => (
              <li key={f}>
                <Tick />
                {f}
              </li>
            ))}
          </ul>
          <button type="button" className="pc-btn pc-btn-light" onClick={toContact}>
            Get Started
          </button>
        </article>
      </div>
    </section>
  )
}
