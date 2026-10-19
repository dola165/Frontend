import type { CSSProperties } from 'react';
import { CalendarDays, Check, Dumbbell, Repeat2 } from 'lucide-react';
import { eventTypeCopy } from '../workspaceTypes';
import { TYPES } from './eventEditorModel';
import type { EventEditor } from './useEventEditor';

/** Step 1, "Plan": the kind of event, its name, one-time or weekly, the squad and notes. */
export function EventPlanStep({ editor }: { editor: EventEditor }) {
    const {
        t, form, squads, squadError, titleInput, recurring, eventType, squadClubId, interval, hasSquad,
        update, selectMode, audience, fixedSquad, mode,
    } = editor;
    return (
        <>
            {!recurring || audience?.privateInvitations ? (
                <div className="schedule-compose-field">
                    <span>{t('schedule.editor.eventType')}</span>
                    <div
                        className="schedule-compose-types"
                        role="group"
                        aria-label={t('schedule.editor.eventType')}
                    >
                        {TYPES.map(({ value, icon: Icon }, index) => (
                            <button
                                data-field={index === 0 ? 'kind' : undefined}
                                type="button"
                                key={value}
                                aria-pressed={eventType === value}
                                style={
                                    {
                                        '--type-accent': eventTypeCopy[value].accent,
                                    } as CSSProperties
                                }
                                onClick={() => update('eventType', value)}
                            >
                                <Icon size={17} />
                                {t(`schedule.event.${value.toLowerCase()}`)}
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                <p className="schedule-compose-inline">
                    <Dumbbell size={17} />
                    {t('schedule.editor.trainingRepeats', { cadence: interval === 1 ? t('schedule.editor.everyWeek') : t('schedule.editor.everyWeeks', { interval }) })}
                </p>
            )}
            <label className="schedule-compose-field">
                <span>
                    {recurring && !audience?.privateInvitations ? t('schedule.editor.trainingName') : t('schedule.editor.eventName')} <b>*</b>
                </span>
                <input
                    ref={titleInput}
                    data-field="title"
                    aria-label={recurring && !audience?.privateInvitations ? t('schedule.editor.trainingName') : t('schedule.editor.eventName')}
                    value={form.title}
                    onChange={(event) => update('title', event.target.value)}
                    maxLength={140}
                    placeholder={
                        recurring
                            ? t('schedule.editor.trainingNamePlaceholder')
                            : t('schedule.editor.eventNamePlaceholder')
                    }
                />
            </label>
            {mode === 'create' && (
                <div
                    className="schedule-compose-modes"
                    role="group"
                    aria-label={t('schedule.editor.scheduleType')}
                >
                    <button
                        type="button"
                        aria-pressed={!recurring}
                        className={!recurring ? 'selected' : ''}
                        onClick={() => selectMode(false)}
                    >
                        <CalendarDays size={22} />
                        <strong>{t('schedule.editor.oneTime')}</strong>
                        <small>
                            {t('schedule.editor.oneTimeHint')}
                        </small>
                        <span className="schedule-compose-choice-dot">
                            {!recurring && <Check size={11} />}
                        </span>
                    </button>
                    <button
                        type="button"
                        aria-pressed={recurring}
                        className={recurring ? 'selected' : ''}
                        onClick={() => selectMode(true)}
                    >
                        <Repeat2 size={22} />
                        <strong>{audience?.privateInvitations ? t('schedule.editor.repeatWeekly', { defaultValue: 'Repeat weekly' }) : t('schedule.editor.weeklyTraining')}</strong>
                        <small>{t('schedule.editor.weeklyChoiceHint')}</small>
                        <span className="schedule-compose-choice-dot">
                            {recurring && <Check size={11} />}
                        </span>
                    </button>
                </div>
            )}
            {audience?.planContent}
            {hasSquad && !fixedSquad && (
                <label className="schedule-compose-field">
                    <span>
                        {t('schedule.editor.squad')} <em>{t('schedule.editor.optional')}</em>
                    </span>
                    <select
                        aria-label={t('schedule.editor.squad')}
                        value={form.hostSquadId ?? ''}
                        disabled={fixedSquad}
                        onChange={(event) =>
                            update(
                                'hostSquadId',
                                event.target.value ? Number(event.target.value) : null,
                            )
                        }
                    >
                        <option value="">{t('schedule.editor.noSquad')}</option>
                        {form.hostSquadId &&
                            !(
                                squads?.clubId === squadClubId &&
                                squads.items.some(
                                    (squad) => squad.id === form.hostSquadId,
                                )
                            ) && (
                                <option value={form.hostSquadId}>{t('schedule.editor.currentSquad')}</option>
                            )}
                        {squads?.clubId === squadClubId &&
                            squads.items.map((squad) => (
                                <option key={squad.id} value={squad.id}>
                                    {squad.name}
                                </option>
                            ))}
                    </select>
                    {squadError && (
                        <small>
                            {t('schedule.editor.squadsFailed')}
                        </small>
                    )}
                </label>
            )}
            <details
                className="schedule-compose-details"
                open={form.description ? true : undefined}
            >
                <summary>
                    {t('schedule.editor.notesHeading')} <span>{t('schedule.editor.optional')}</span>
                </summary>
                <label className="schedule-compose-field">
                    <span className="sr-only">{t('schedule.editor.eventNotes')}</span>
                    <textarea
                        aria-label={t('schedule.editor.eventNotes')}
                        value={form.description ?? ''}
                        onChange={(event) => update('description', event.target.value)}
                        maxLength={2000}
                        rows={3}
                        placeholder={t('schedule.editor.notesPlaceholder')}
                    />
                </label>
            </details>
        </>
    );
}
