import type { PitchEditor } from './usePitchEditor';

/** Step 2, "Price & availability": hourly rate, covered and active, and which physical space the pitch shares. */
export function PitchAvailabilityStep({ editor }: { editor: PitchEditor }) {
  const { venue, step, pitch, setPitch } = editor;
  return (
    <div hidden={step !== 1} data-flow-step="1" className="venue-form">
    <label className="venue-field">
      <span>Hourly rate ({venue.currency})</span>
      <input
        type="number"
        min="0"
        step="0.01"
        required
        value={pitch.pricePerHour}
        onChange={(event) =>
          setPitch({ ...pitch, pricePerHour: Number(event.target.value) })
        }
      />
    </label>
    <label className="venue-checkbox">
      <input
        type="checkbox"
        checked={!!pitch.covered}
        onChange={(event) =>
          setPitch({ ...pitch, covered: event.target.checked })
        }
      />
      Covered pitch
    </label>
    <label className="venue-checkbox">
      <input
        type="checkbox"
        checked={!!pitch.active}
        onChange={(event) =>
          setPitch({ ...pitch, active: event.target.checked })
        }
      />
      Active and available to book
    </label>
    <section className="venue-shared-space"><h3>Which physical space does this use?</h3><p className="venue-muted">A full field and its halves must share availability. Separate pitches keep their own calendar.</p>
      <label className="venue-field"><span>Physical space</span><select aria-label="Physical space" value={venue.pitches.some(p => p.id !== pitch.id && p.resourceGroup === pitch.resourceGroup) ? pitch.resourceGroup : '__own'} onChange={event => {
        const other = venue.pitches.find(p => p.resourceGroup === event.target.value);
        setPitch({ ...pitch, resourceGroup: other?.resourceGroup || '', resourceUnits: other?.resourceUnits || [] });
      }}><option value="__own">Independent pitch / its own ground</option>{[...new Map(venue.pitches.filter(p => p.id !== pitch.id && p.resourceGroup).map(p => [p.resourceGroup, p])).values()].map(p => <option key={p.resourceGroup} value={p.resourceGroup}>Same ground as {p.name}</option>)}</select></label>
      {pitch.resourceGroup && venue.pitches.some(p => p.id !== pitch.id && p.resourceGroup === pitch.resourceGroup) && <fieldset className="venue-resource-fields"><legend>Sections this option occupies</legend>{[...new Set(venue.pitches.filter(p => p.resourceGroup === pitch.resourceGroup).flatMap(p => p.resourceUnits))].map(unit => <label key={unit} className="venue-checkbox"><input type="checkbox" checked={pitch.resourceUnits.includes(unit)} onChange={event => setPitch({ ...pitch, resourceUnits: event.target.checked ? [...pitch.resourceUnits, unit] : pitch.resourceUnits.filter(u => u !== unit) })}/>{unit === 'left' ? 'Left half' : unit === 'right' ? 'Right half' : unit}</label>)}<p className="venue-muted">Select every section used. A booking blocks any other option using one of these sections.</p></fieldset>}
      <button type="button" className="venue-link" onClick={() => setPitch({ ...pitch, resourceGroup: pitch.resourceGroup || `ground-${crypto.randomUUID()}`, resourceUnits: ['left', 'right'] })}>Set this up as a full field with two halves</button><p className="venue-muted">Save the full field first. Add each half as a new pitch, choose the same ground and select its half. Changing shared space may be refused while existing bookings need the current arrangement.</p>
    </section>
    <details><summary>Advanced shared-space settings</summary><fieldset className="venue-resource-fields">
      <legend>
        Shared pitch space <small>(optional)</small>
      </legend>
      <label className="venue-field">
        <span>Shared ground name</span>
        <input
          value={pitch.resourceGroup}
          maxLength={80}
          placeholder="main-field"
          pattern="[A-Za-z0-9_-]{1,80}"
          onChange={(event) =>
            setPitch({ ...pitch, resourceGroup: event.target.value })
          }
        />
      </label>
      <label className="venue-field">
        <span>
          Sections used <small>(comma separated)</small>
        </span>
        <input
          value={pitch.resourceUnits.join(", ")}
          maxLength={250}
          placeholder="left, right"
          onChange={(event) =>
            setPitch({
              ...pitch,
              resourceUnits: event.target.value
                .split(",")
                .map((value) => value.trimStart()),
            })
          }
        />
      </label>
      <p className="venue-muted">
        Use letters, numbers, hyphens or underscores for shared names and
        sections. Leave both blank for an independent pitch.
      </p>
    </fieldset></details>
    </div>
  );
}
