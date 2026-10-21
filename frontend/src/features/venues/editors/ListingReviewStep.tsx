import type { ListingEditor } from './useListingEditor';

/** Step 4, "Review & publish": what is still missing, and the publish switch. */
export function ListingReviewStep({ editor }: { editor: ListingEditor }) {
  const { step, setStep, draft, change, readiness } = editor;
  return (
    <div hidden={step !== 3} data-flow-step="3" className="venue-flow-main">
      <section className="venue-panel"><p className="venue-eyebrow">Ready for your first visitors?</p><h2>Review your stadium page</h2><p>Check the preview, then choose whether to publish.</p>
        <div className="venue-readiness">{readiness.map(item => <button key={item.label} type="button" className={item.ready ? 'is-ready' : ''} onClick={() => item.step >= 0 && setStep(item.step)}><span>{item.ready ? '✓' : '○'}</span>{item.label}{item.step === -1 && !item.ready && <small> — save a draft, then open Pitches</small>}</button>)}</div>
        <p className="venue-muted">Before accepting online requests, add your existing phone bookings, regular team slots and closures in Calendar & reservations.</p>
        <p className="venue-muted">{draft.bookingMode === 'INSTANT' ? 'Instant mode confirms available online bookings automatically. Keep your calendar current.' : 'Request mode lets you approve each online booking. Unanswered requests expire automatically.'} Payment is arranged at the venue.</p>
      </section><section className="venue-panel">
        <h2>Publishing</h2>
        <p>
          Publish after adding a photo, an active pitch, opening hours,
          address, map location and phone number.
        </p>
        <label className="venue-checkbox">
          <input
            type="checkbox"
            checked={draft.published}
            onChange={(event) => change("published", event.target.checked)}
          />
          Publish stadium page
        </label>
        <p className="venue-muted">
          Save before leaving this workspace. You can switch its tabs without losing your draft.
        </p>
      </section>
    </div>
  );
}
