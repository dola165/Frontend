import type { Venue } from "../api";
import type { ListingEditor } from './useListingEditor';

/** Step 3, "Hours & booking rules": opening hours per weekday, confirmation, currency and booking limits. */
export function ListingHoursStep({ editor }: { editor: ListingEditor }) {
  const { step, draft, change } = editor;
  return (
    <div hidden={step !== 2} data-flow-step="2" className="venue-flow-main"><section className="venue-panel">
        <h2>Opening hours</h2>
        <p>
          In {draft.timezone}. Unchecked days are closed. An earlier closing
          time means the pitch stays open past midnight into the next day.
        </p>
        <div className="venue-hours-editor">
          {Array.from({ length: 7 }, (_, index) => index + 1).map((day) => {
            const hours = draft.openingHours.find(
              (value) => value.dayOfWeek === day,
            );
            const dayName = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][
              day - 1
            ];
            return (
              <div key={day}>
                <label className="venue-checkbox">
                  <input
                    type="checkbox"
                    checked={!!hours}
                    onChange={(event) =>
                      change(
                        "openingHours",
                        event.target.checked
                          ? [
                              ...draft.openingHours,
                              {
                                dayOfWeek: day,
                                opensAt: "08:00",
                                closesAt: "23:00",
                              },
                            ]
                          : draft.openingHours.filter(
                              (value) => value.dayOfWeek !== day,
                            ),
                      )
                    }
                  />
                  {dayName}
                </label>
                {hours ? (
                  <>
                    <input
                      aria-label={`${dayName} opening time`}
                      type="time"
                      value={hours.opensAt.slice(0, 5)}
                      onChange={(event) =>
                        change(
                          "openingHours",
                          draft.openingHours.map((value) =>
                            value.dayOfWeek === day
                              ? { ...value, opensAt: event.target.value }
                              : value,
                          ),
                        )
                      }
                    />
                    <span>–</span>
                    <input
                      aria-label={`${dayName} closing time`}
                      type="time"
                      value={hours.closesAt.slice(0, 5)}
                      onChange={(event) =>
                        change(
                          "openingHours",
                          draft.openingHours.map((value) =>
                            value.dayOfWeek === day
                              ? { ...value, closesAt: event.target.value }
                              : value,
                          ),
                        )
                      }
                    />
                  </>
                ) : (
                  <span className="venue-muted">Closed</span>
                )}
              </div>
            );
          })}
        </div>
      </section><section className="venue-panel">
        <h2>Booking rules</h2>
        <div className="venue-form">
          <label className="venue-field">
            <span>Confirmation</span><small className="editor-field-help">Choose whether each booking needs your approval or is confirmed automatically when the pitch is available.</small>
            <select
              aria-label="Confirmation"
              value={draft.bookingMode}
              onChange={(event) =>
                change(
                  "bookingMode",
                  event.target.value as Venue["bookingMode"],
                )
              }
            >
              <option value="REQUEST">I confirm each request</option>
              <option value="INSTANT">Instant confirmation</option>
            </select>
          </label>
          <label className="venue-field">
            <span>Currency</span>
            <select
              value={draft.currency}
              onChange={(event) => change("currency", event.target.value)}
            >
              {["GEL", "USD", "EUR", "GBP"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="venue-field">
            <span>Booking interval (minutes)</span><small className="editor-field-help">Spacing between available start times. For example, 30 minutes offers 10:00, 10:30 and 11:00.</small>
            <select
              value={draft.slotMinutes}
              onChange={(event) =>
                change("slotMinutes", Number(event.target.value))
              }
            >
              {[15, 30, 60].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <div className="venue-form-grid">
            <label className="venue-field">
              <span>Shortest booking (minutes)</span>
              <input
                type="number"
                min="30"
                max="720"
                step={draft.slotMinutes}
                required
                value={draft.minBookingMinutes}
                onChange={(event) =>
                  change("minBookingMinutes", Number(event.target.value))
                }
              />
            </label>
            <label className="venue-field">
              <span>Longest booking (minutes)</span>
              <input
                type="number"
                min={draft.minBookingMinutes}
                max="720"
                step={draft.slotMinutes}
                required
                value={draft.maxBookingMinutes}
                onChange={(event) =>
                  change("maxBookingMinutes", Number(event.target.value))
                }
              />
            </label>
          </div>
          <label className="venue-field">
            <span>Cancellation notice (hours)</span><small className="editor-field-help">How far before the booking customers must cancel. Use 0 for no advance notice.</small>
            <input
              type="number"
              min="0"
              max="168"
              required
              value={draft.cancellationHours}
              onChange={(event) =>
                change("cancellationHours", Number(event.target.value))
              }
            />
          </label>
        </div>
      </section></div>
  );
}
