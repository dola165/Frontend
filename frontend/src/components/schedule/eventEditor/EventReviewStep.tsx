import { Check, Globe, Lock, ShieldCheck } from 'lucide-react';
import type { EventEditor } from './useEventEditor';

/** Step 3, "Review & share": the summary and who can see the event. */
export function EventReviewStep({ editor }: { editor: EventEditor }) {
    const {
        t, readableDate, form, isClub, recurring, date, start, end, endDate, minutes, interval, daysText,
        squadName, hasSquad, update, audience, fixedSquad, subjectLabel,
    } = editor;
    return (
        <>
            <div className="schedule-compose-review">
                <div>
                    <span>{t('schedule.editor.what')}</span>
                    <strong>{form.title || t('schedule.editor.addEventName')}</strong>
                </div>
                <div>
                    <span>{t('schedule.editor.when')}</span>
                    <strong>
                        {recurring
                            ? `${daysText || t('schedule.editor.chooseWeekdays')} · ${interval === 1 ? t('schedule.editor.everyWeek') : t('schedule.editor.everyWeeks', { interval })}`
                            : `${readableDate(date)}${endDate !== date ? ` → ${readableDate(endDate)}` : ''}`}
                        <small>
                            {start && end
                                ? `${start} – ${end}`
                                : t('schedule.editor.chooseTimes')}
                            {minutes ? ` · ${t('schedule.editor.minutesLong', { minutes })}` : ''}
                        </small>
                    </strong>
                </div>
                {recurring && (
                    <div>
                        <span>{t('schedule.editor.dates')}</span>
                        <strong>
                            {readableDate(date)}
                            {form.recurrenceEndDate
                                ? ` → ${readableDate(form.recurrenceEndDate)}`
                                : t('schedule.editor.noEndDate')}
                        </strong>
                    </div>
                )}
                <div>
                    <span>{t('schedule.editor.where')}</span>
                    <strong>{form.locationName || t('schedule.editor.noLocation')}</strong>
                </div>
                {hasSquad && form.hostSquadId && (
                    <div>
                        <span>{t('schedule.editor.squad')}</span>
                        <strong>{squadName || (fixedSquad ? subjectLabel : t('schedule.editor.currentSquad'))}</strong>
                    </div>
                )}
            </div>
            {audience?.reviewContent(form)}
            {isClub && !audience?.privateInvitations ? (
                <>
                    <div className="schedule-compose-field">
                        <span>{t('schedule.event.whoCanSee')}</span>
                        <div
                            className="schedule-compose-sharing"
                            role="group"
                            aria-label={t('schedule.editor.eventVisibility')}
                        >
                            <button
                                type="button"
                                aria-pressed={form.visibility === 'PRIVATE'}
                                onClick={() => update('visibility', 'PRIVATE')}
                            >
                                <ShieldCheck size={20} />
                                <span>
                                    <strong>{t('schedule.editor.clubMembers')}</strong>
                                    <small>{t('schedule.editor.clubVisibilityHint')}</small>
                                </span>
                                {form.visibility === 'PRIVATE' && <Check size={16} />}
                            </button>
                            <button
                                type="button"
                                aria-pressed={form.visibility === 'PUBLIC'}
                                onClick={() => update('visibility', 'PUBLIC')}
                            >
                                <Globe size={20} />
                                <span>
                                    <strong>{t('schedule.event.public')}</strong>
                                    <small>{t('schedule.editor.publicVisibilityHint')}</small>
                                </span>
                                {form.visibility === 'PUBLIC' && <Check size={16} />}
                            </button>
                        </div>
                    </div>
                    <details
                        className="schedule-compose-details"
                        open={
                            form.visibility === 'SCHEDULED_PUBLICATION'
                                ? true
                                : undefined
                        }
                    >
                        <summary>
                            {t('schedule.editor.publishLater')} <span>{t('schedule.editor.optional')}</span>
                        </summary>
                        <label className="schedule-compose-checkbox">
                            <input
                                type="checkbox"
                                checked={form.visibility === 'SCHEDULED_PUBLICATION'}
                                onChange={(event) =>
                                    update(
                                        'visibility',
                                        event.target.checked
                                            ? 'SCHEDULED_PUBLICATION'
                                            : 'PRIVATE',
                                    )
                                }
                            />
                            {t('schedule.editor.choosePublication')}
                        </label>
                        {form.visibility === 'SCHEDULED_PUBLICATION' && (
                            <label className="schedule-compose-field">
                                <span>{t('schedule.event.publishOn')}</span>
                                <input
                                    data-field="publishAt"
                                    aria-label={t('schedule.event.publishOn')}
                                    type="datetime-local"
                                    value={form.publishAt}
                                    onChange={(event) =>
                                        update('publishAt', event.target.value)
                                    }
                                />
                                <small>
                                    {t('schedule.editor.publicationHint')}
                                </small>
                            </label>
                        )}
                    </details>
                    {hasSquad && form.hostSquadId && (
                        <p className="schedule-compose-muted">
                            {t('schedule.editor.squadVisibilityHint')}
                        </p>
                    )}
                </>
            ) : !audience?.privateInvitations ? (
                <div className="schedule-compose-privacy">
                    <Lock size={20} />
                    <div>
                        <strong>{audience?.privateInvitations ? audience.privacyLabel : t('schedule.editor.privateTitle')}</strong>
                        <p>
                            {audience?.privateInvitations ? subjectLabel : t('schedule.editor.privateHint')}
                        </p>
                    </div>
                </div>
            ) : null}
        </>
    );
}
