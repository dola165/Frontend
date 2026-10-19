import { CalendarDays, Clock, Globe, Lock, MapPin, Repeat2, Users } from 'lucide-react';
import type { EventEditor } from './useEventEditor';

/** The live preview beside the steps: the event as it will look on the schedule, and the first sessions of a routine. */
export function EventPreview({ editor }: { editor: EventEditor }) {
    const {
        t, readableDate, form, step, isClub, recurring, eventType, savedSeries, startedSeries, date, start,
        end, endDate, minutes, interval, sessionDates, daysText, squadName, hasSquad, privacyText, audience,
        fixedSquad, subjectLabel,
    } = editor;
    return (
        <aside className="schedule-compose-preview" aria-label={t('schedule.editor.schedulePreview')}>
            <div className="schedule-compose-preview-heading">
                <span>{t('schedule.editor.onSchedule')}</span>
                <span>
                    <i />
                    {t('schedule.editor.livePreview')}
                </span>
            </div>
            <article className="schedule-compose-event-card">
                <div className="schedule-compose-event-meta">
                    <span>{eventType ? t(`schedule.event.${eventType.toLowerCase()}`) : t('schedule.editor.yourEvent')}</span>
                    {recurring && <Repeat2 size={17} />}
                </div>
                <h3>{form.title || (recurring && !audience?.privateInvitations ? t('schedule.editor.yourTraining') : t('schedule.editor.yourNextEvent'))}</h3>
                <p>
                    <CalendarDays size={16} />
                    {recurring ? daysText || t(audience?.privateInvitations ? 'schedule.editor.chooseEventDays' : 'schedule.editor.chooseTrainingDays') : `${readableDate(date)}${endDate !== date ? ` → ${readableDate(endDate)}` : ''}`}
                </p>
                <p>
                    <Clock size={16} />
                    {start && end ? `${start} – ${end}` : t('schedule.editor.chooseTime')}
                    {minutes && <small>{t('schedule.editor.minutesShort', { minutes })}</small>}
                </p>
                {hasSquad && form.hostSquadId && (
                    <p>
                        <Users size={16} />
                        {squadName || (fixedSquad ? subjectLabel : t('schedule.editor.currentSquad'))}
                    </p>
                )}
                <p>
                    <MapPin size={16} />
                    {form.locationName || t('schedule.editor.locationToAdd')}
                </p>
                <footer>
                    {isClub && form.visibility === 'PUBLIC' ? <Globe size={13} /> : <Lock size={13} />}{' '}
                    {privacyText}
                    {recurring && (
                        <span>{interval === 1 ? t('schedule.editor.repeatsWeekly') : t('schedule.editor.everyWeeksCapital', { interval })}</span>
                    )}
                </footer>
            </article>
            {recurring && (
                <section className="schedule-compose-next">
                    <h4>{t(audience?.privateInvitations ? 'schedule.editor.firstEvents' : 'schedule.editor.firstSessions')}</h4>
                    {sessionDates.length ? (
                        <ol>
                            {sessionDates.map((day, index) => (
                                <li key={day}>
                                    <span>{String(index + 1).padStart(2, '0')}</span>
                                    <div>
                                        <strong>{readableDate(day)}</strong>
                                        <small>
                                            {start} – {end}
                                        </small>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    ) : (
                        <p>{t(audience?.privateInvitations ? 'schedule.editor.firstEventsHint' : 'schedule.editor.firstSessionsHint')}</p>
                    )}
                </section>
            )}
            <p className="schedule-compose-preview-note">
                {startedSeries
                    ? t('schedule.editor.savedSeriesDetails')
                    : step < 2
                      ? t('schedule.editor.notSavedYet')
                      : savedSeries
                        ? t('schedule.editor.saveWholeSeries')
                        : t('schedule.editor.appearsWhenSaved')}
            </p>
        </aside>
    );
}
