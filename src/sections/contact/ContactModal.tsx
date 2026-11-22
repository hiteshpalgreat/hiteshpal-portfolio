import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { EMAIL, WEB3FORMS_KEY } from './contactConfig'
import './contact.css'

type Status = 'idle' | 'sending' | 'sent' | 'error'

/**
 * The "send me a message" pop-up: title, message, email and an optional phone number. With a Web3Forms key
 * it lands straight in Hittu's inbox; without one it opens the visitor's mail app with everything filled in.
 */
export function ContactModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [status, setStatus] = useState<Status>('idle')
  const form = useRef<HTMLFormElement>(null)
  const dialog = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setStatus('idle')
    const back = document.activeElement as HTMLElement | null
    const t = window.setTimeout(() => dialog.current?.querySelector<HTMLInputElement>('input')?.focus(), 80)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        onClose()
      }
      // keep Tab inside the dialog
      if (e.key === 'Tab' && dialog.current) {
        const f = dialog.current.querySelectorAll<HTMLElement>('button, input, textarea, a[href]')
        if (!f.length) return
        const first = f[0], last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('keydown', onKey, true)
      back?.focus?.({ preventScroll: true })
    }
  }, [open, onClose])

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const title = String(f.get('title') || '').trim()
    const message = String(f.get('message') || '').trim()
    const email = String(f.get('email') || '').trim()
    const phone = String(f.get('phone') || '').trim()
    const body = `${message}\n\nFrom: ${email}${phone ? `\nPhone: ${phone}` : ''}`
    if (!WEB3FORMS_KEY) {
      window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`
      setStatus('sent')
      return
    }
    setStatus('sending')
    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ access_key: WEB3FORMS_KEY, subject: `Portfolio: ${title}`, from_name: 'Portfolio contact form', email, replyto: email, phone, title, message }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.success === false) throw new Error('send failed')
      setStatus('sent')
      form.current?.reset()
    } catch {
      setStatus('error')
    }
  }

  return createPortal(
    <div className={`ct-modal ${open ? 'open' : ''}`} aria-hidden={!open} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ct-dialog" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="ct-dialog-title">
        <button type="button" className="ct-close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
        {status === 'sent' ? (
          <div className="ct-done" role="status">
            <span className="ct-done-badge" aria-hidden="true">✓</span>
            <h3 id="ct-dialog-title">Thanks, it's on its way.</h3>
            <p>I'll get back to you as soon as I can.</p>
            <div className="ct-done-actions">
              <button type="button" className="ct-send" onClick={onClose}>
                Close
              </button>
              <button type="button" className="ct-link" onClick={() => setStatus('idle')}>
                Send another
              </button>
            </div>
          </div>
        ) : (
          <>
            <span className="ct-dialog-eyebrow">( say hello )</span>
            <h3 className="ct-dialog-title" id="ct-dialog-title">
              Tell me about <em>your project</em>
            </h3>
            <form ref={form} className="ct-form" onSubmit={submit}>
              <label className="ct-field ct-wide">
                <span>Message title</span>
                <input name="title" required maxLength={140} placeholder="A rebrand for our app launch" />
              </label>
              <label className="ct-field ct-wide">
                <span>Message</span>
                <textarea name="message" required rows={5} placeholder="What are you making, when do you need it, and anything you love." />
              </label>
              <label className="ct-field">
                <span>Your email</span>
                <input name="email" type="email" required autoComplete="email" placeholder="you@company.com" />
              </label>
              <label className="ct-field">
                <span>
                  Phone <i>(optional)</i>
                </span>
                <input name="phone" type="tel" autoComplete="tel" placeholder="+91 …" />
              </label>
              <div className="ct-submit">
                <button type="submit" className="ct-send" disabled={status === 'sending'}>
                  {status === 'sending' ? 'Sending…' : 'Send message'}
                </button>
                {status === 'error' && (
                  <span className="ct-err" role="alert">
                    That didn't go through. Try again, or write to <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
                  </span>
                )}
              </div>
            </form>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
