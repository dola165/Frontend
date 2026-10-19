import { lazy, Suspense } from 'react';
import { MapPin } from 'lucide-react';
import { localDateISO } from '../scheduleFormUtils';
import type { EventEditor } from './useEventEditor';

// The venue picker map and its library load only when someone opens the picker, not with every schedule page.
const MiniMap = lazy(() => import('../../MiniMap').then(module => ({ default: module.MiniMap })));

/** Step 2, "When & where": weekdays or date, times, duration, the dates of a weekly routine and the place. */
export function EventWhenWhereStep({ editor }: { editor: EventEditor }) {
    const {
        t, days, readableDate, form, setForm, mapOpen, setMapOpen, recurring, date, start, end,
        overnightEnabled, endDate, minutes, sessionDates, update, applyDuration, lat, lng, audience,
    } = editor;
    return (
        <>
            {recurring && (
                <div className="schedule-compose-field">
                    <span>
                        {t(audience?.privateInvitations ? 'schedule.editor.eventDays' : 'schedule.editor.trainingDays')} <b>*</b>
                    </span>
                    <div
                        className="schedule-compose-weekdays"
                        role="group"
                        aria-label={t(audience?.privateInvitations ? 'schedule.editor.eventDays' : 'schedule.editor.trainingDays')}
                    >
                        {days.map((day, index) => (
                            <button
                                data-field={index === 0 ? 'days' : undefined}
                                type="button"
                                key={day.value}
                                aria-label={day.label}
                                aria-pressed={
                                    form.recurrenceDays?.includes(day.value) ?? false
                                }
                                onClick={() =>
                                    update(
                                        'recurrenceDays',
                                        form.recurrenceDays?.includes(day.value)
                                            ? form.recurrenceDays.filter(
                                                  (value) => value !== day.value,
                                              )
                                            : [
                                                  ...(form.recurrenceDays ?? []),
                                                  day.value,
                                              ],
                                    )
                                }
                            >
                                {day.short}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {!recurring && (
                <label className="schedule-compose-field">
                    <span>
                        {t('schedule.event.date')} <b>*</b>
                    </span>
                    <input
                        data-field="date"
                        aria-label={t('schedule.event.date')}
                        type="date"
                        min={localDateISO()}
                        value={date}
                        onChange={(event) => update('date', event.target.value)}
                    />
                </label>
            )}
            <div className="schedule-compose-row">
                <label className="schedule-compose-field">
                    <span>
                        {t('schedule.editor.starts')} <b>*</b>
                    </span>
                    <input
                        data-field="startTime"
                        aria-label={t('schedule.editor.startTime')}
                        type="time"
                        value={start}
                        onChange={(event) =>
                            update(
                                recurring ? 'recurrenceStartTime' : 'startTime',
                                event.target.value,
                            )
                        }
                    />
                </label>
                <label className="schedule-compose-field">
                    <span>
                        {t('schedule.editor.ends')} <b>*</b>
                    </span>
                    <input
                        data-field="endTime"
                        aria-label={t('schedule.editor.endTime')}
                        type="time"
                        value={end}
                        onChange={(event) =>
                            update(
                                recurring ? 'recurrenceEndTime' : 'endTime',
                                event.target.value,
                            )
                        }
                    />
                </label>
            </div>
            {overnightEnabled && <label className="schedule-compose-field">
                <span>{t('schedule.editor.eventEndDate')}</span>
                <input data-field="eventEndDate" aria-label={t('schedule.editor.eventEndDate')} type="date" min={date} value={endDate}
                    onChange={event => update('endDate', event.target.value)} />
            </label>}
            <div className="schedule-compose-duration">
                <span>{t('schedule.editor.duration')}</span>
                {[45, 60, 90, 120].map((duration) => (
                    <button
                        type="button"
                        key={duration}
                        aria-pressed={minutes === duration}
                        onClick={() => applyDuration(duration)}
                    >
                        {duration < 60
                            ? t('schedule.editor.minutesShort', { minutes: duration })
                            : duration === 60
                              ? t('schedule.editor.oneHour')
                              : duration === 90
                                ? t('schedule.editor.oneHalfHours')
                                : t('schedule.editor.twoHours')}
                    </button>
                ))}
            </div>
            {recurring && (
                <div className="schedule-compose-row">
                    <label className="schedule-compose-field">
                        <span>
                            {t('schedule.editor.startsFrom')} <b>*</b>
                        </span>
                        <input
                            data-field="date"
                            aria-label={t('schedule.editor.trainingStartDate')}
                            type="date"
                            min={localDateISO()}
                            value={date}
                            onChange={(event) =>
                                update('recurrenceStartDate', event.target.value)
                            }
                        />
                        <small>
                            {t('schedule.editor.firstSession', { date: sessionDates[0] ? readableDate(sessionDates[0]) : t('schedule.editor.chooseDaysDates') })}
                        </small>
                    </label>
                    <label className="schedule-compose-field">
                        <span>
                            {t('schedule.editor.endsOn')} <em>{t('schedule.editor.optional')}</em>
                        </span>
                        <input
                            data-field="endDate"
                            aria-label={t('schedule.editor.trainingEndDate')}
                            type="date"
                            min={date || localDateISO()}
                            value={form.recurrenceEndDate ?? ''}
                            onChange={(event) =>
                                update('recurrenceEndDate', event.target.value)
                            }
                        />
                        <small>{t(audience?.privateInvitations ? 'schedule.editor.seriesEndHint' : 'schedule.editor.ongoingHint')}</small>
                    </label>
                </div>
            )}
            <div className="schedule-compose-divider" />
            <label className="schedule-compose-field">
                <span>
                    {t('schedule.event.location')} <em>{t('schedule.editor.optional')}</em>
                </span>
                <div className="schedule-compose-location-input">
                    <MapPin size={17} />
                    <input
                        aria-label={t('schedule.event.location')}
                        value={form.locationName}
                        onChange={(event) => update('locationName', event.target.value)}
                        maxLength={255}
                        placeholder={t('schedule.editor.locationPlaceholder')}
                    />
                </div>
            </label>
            {!audience?.privateInvitations && <div className="schedule-compose-map-actions">
                <button
                    type="button"
                    className="schedule-compose-text-button"
                    aria-expanded={mapOpen}
                    onClick={() => setMapOpen((value) => !value)}
                >
                    <MapPin size={15} />
                    {mapOpen
                        ? t('schedule.editor.hideMap')
                        : lat != null && lng != null
                          ? t('schedule.editor.changeMapLocation')
                          : t('schedule.editor.chooseMapLocation')}
                </button>
                {lat != null && lng != null && (
                    <button
                        type="button"
                        className="schedule-compose-text-button"
                        onClick={() =>
                            setForm((previous) => ({
                                ...previous,
                                locationLat: '',
                                locationLng: '',
                            }))
                        }
                    >
                        {t('schedule.editor.removePin')}
                    </button>
                )}
            </div>}
            {mapOpen && !audience?.privateInvitations && (
                <Suspense fallback={<div aria-hidden="true" className="h-[264px]" />}><MiniMap
                    mode="picker"
                    title={t('schedule.editor.chooseVenue')}
                    selectedLocation={{ lat, lng }}
                    onSelectLocation={({ lat, lng }) =>
                        setForm((previous) => ({
                            ...previous,
                            locationLat: String(lat),
                            locationLng: String(lng),
                        }))
                    }
                /></Suspense>
            )}
            <p className="schedule-compose-muted">
                {t('schedule.direction.timezone', { timezone: recurring && form.recurrenceTimezone ? form.recurrenceTimezone.replaceAll('_', ' ') : Intl.DateTimeFormat().resolvedOptions().timeZone })}
            </p>
        </>
    );
}
