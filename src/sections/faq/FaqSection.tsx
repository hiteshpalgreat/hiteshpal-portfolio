import { useState } from 'react'
import './faq.css'

/** Questions people ask before working together. Edit freely: one entry per question. */
export const FAQS: { q: string; a: string }[] = [
  {
    q: 'What kind of design work do you take on?',
    a: 'Brand identity, static creatives and campaigns, product (UI/UX) design, motion and animation, and 3D visualisation, often with AI-assisted production in the mix. If it needs to look good and say something clearly, I can probably help.',
  },
  {
    q: 'How does the monthly package work?',
    a: 'One flat rate of $2,500 a month for unlimited design requests. Add as many as you like to the queue; I work through them in order of priority, and we catch up in a weekly meeting.',
  },
  {
    q: 'Can I pause or cancel the subscription?',
    a: 'Yes, anytime. There is no long-term contract, so you can pause when work is quiet and pick it back up when you need me again.',
  },
  {
    q: 'Do you work with clients outside India?',
    a: 'All the time. I have worked with teams in the US, Europe, Australia, Dubai and Egypt, and I am used to planning around time zones so feedback never waits long.',
  },
  {
    q: 'Which tools do you use?',
    a: 'Software: Figma, Adobe Photoshop, Illustrator, After Effects and Premiere Pro, Blender, Spline, Spine 2D, Rive, LottieFiles, KeyShot, Twinmotion and Framer. AI: Magnific, HeyGen, Higgsfield, Kling, Google Flow and Google Stitch, used where they speed things up without cutting corners.',
  },
]

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section className="faq" id="faq" aria-labelledby="fq-heading">
      <div className="fq-inner">
        <div className="fq-side">
          <span className="fq-eyebrow">( FAQ )</span>
          <h2 className="fq-heading" id="fq-heading">
            Curious? <em>Good.</em>
          </h2>
          <p className="fq-lede">The things people usually wonder before we start. Still curious about something? Ask me below.</p>
        </div>
        <ul className="fq-list">
          {FAQS.map((f, i) => {
            const on = open === i
            return (
              <li key={f.q} className={`fq-item ${on ? 'open' : ''}`}>
                <button type="button" className="fq-q" aria-expanded={on} aria-controls={`fq-a-${i}`} id={`fq-q-${i}`} onClick={() => setOpen(on ? null : i)}>
                  <span>{f.q}</span>
                  <i className="fq-icon" aria-hidden="true" />
                </button>
                <div className="fq-a" id={`fq-a-${i}`} role="region" aria-labelledby={`fq-q-${i}`}>
                  <div>
                    <p>{f.a}</p>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
