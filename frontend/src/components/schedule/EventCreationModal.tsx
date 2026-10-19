import { lazy, Suspense, type CSSProperties } from 'react';
import { Trans } from 'react-i18next';
import { Ban, CalendarDays, Check, ChevronLeft, ChevronRight, Clock, Dumbbell, Globe, Loader2, Lock, MapPin, Repeat2, ShieldCheck, Users, X } from 'lucide-react';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { isExtensionCapabilityAvailable } from '../../features/capabilities/extensions';
import { localDateISO } from './scheduleFormUtils';
import { eventTypeCopy } from './workspaceTypes';
import { TYPES, type EventCreationModalProps } from './eventEditor/eventEditorModel';
import { useEventEditor } from './eventEditor/useEventEditor';
import './eventEditor/event-dialog.css';
import './eventEditor/event-fields.css';
import './eventEditor/event-review.css';
import './eventEditor/event-preview.css';
import './eventEditor/event-actions.css';
import './eventEditor/event-responsive.css';
import './schedule-editor-identity.css';

// The venue picker map and its library load only when someone opens the picker, not with every schedule page.
const MiniMap = lazy(() => import('../MiniMap').then(module => ({ default: module.MiniMap })));

export type { EventCreationFormValues, ModalMode, ModalSurface } from './eventEditor/eventEditorModel';

export const EventCreationModal = (props: EventCreationModalProps) => props.isOpen ? <EventCreationContent {...props} /> : null;

const EventCreationContent = (props: EventCreationModalProps) => {
    const editor = useEventEditor(props);
    const {
        STEPS, accent, applyDuration, audience, audienceNotice, busy, canCancel, cancelConfirm, content,
        date, days, daysText, descriptionId, dialog, discard, end, endDate, error, eventType, fixedSquad,
        form, handleCancel, handleSave, hasSquad, headline, inFlight, interval, isClub, issue, lat, lng,
        mapOpen, minutes, mode, motion, navigateStep, next, onClose, overnightEnabled, privacyText, readOnly,
        readableDate, recurring, requestClose, saveLabel, savedSeries, selectMode, sessionDates,
        setCancelConfirm, setDiscard, setForm, setMapOpen, showIssue, squadClubId, squadError, squadName,
        squads, start, startedSeries, step, stepHeading, subjectLabel, submitting, surface, t, targetEventId,
        targetEventStartsAt, titleId, titleInput, update,
    } = editor;
    if (!props.isOpen) return null;
    return (
        <div className="app-motion-portal app-motion-backdrop schedule-compose-backdrop" data-closing={motion.closing} onClick={requestClose}>
            <div
                ref={dialog}
                className="app-motion-dialog schedule-compose" data-closing={motion.closing} onAnimationEnd={motion.onAnimationEnd}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                aria-busy={busy}
                style={{ '--event-accent': accent } as CSSProperties}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                    if (event.key !== 'Enter' || event.nativeEvent.isComposing || readOnly) return;
                    const target = event.target as HTMLElement;
                    if (!target.matches('input:not([type="checkbox"]):not([type="radio"])')) return;
                    event.preventDefault();
                    if (step < 2) next();
                    else void handleSave();
                }}
            >
                <header className="schedule-compose-header">
                    <div>
                        <div className="schedule-compose-context">
                            <CalendarDays size={14} />
                            <span>{isClub ? subjectLabel : t('schedule.editor.mySchedule')}</span>
                            <ChevronRight size={12} />
                            <span>{savedSeries ? t('schedule.editor.trainingSeries') : t('schedule.editor.planYourTime')}</span>
                        </div>
                        <h2 id={titleId}>{headline}</h2>
                        <p id={descriptionId}>
                            {recurring && !audience?.privateInvitations
                                ? t('schedule.editor.weeklyIntro')
                                : t('schedule.editor.singleIntro')}
                        </p>
                    </div>
                    <button
                        className="schedule-compose-close"
                        type="button"
                        onClick={requestClose}
                        disabled={busy}
                        aria-label={t('schedule.editor.closeEditor')}
                    >
                        <X size={20} />
                    </button>
                </header>
                {audienceNotice && <p className="schedule-compose-steps" role="note">{audienceNotice}</p>}
                {mode === 'edit' && surface === 'CLUB_SCHEDULE' && targetEventId != null && (isExtensionCapabilityAvailable('eventVenueAttachment') || isExtensionCapabilityAvailable('volunteerShifts')) && <div className="schedule-compose-steps">
                    {isExtensionCapabilityAvailable('eventVenueAttachment') && <a target="_blank" rel="noopener noreferrer" href={`/event-venues?type=CLUB_EVENT&id=${targetEventId}${targetEventStartsAt?`&occurrenceStart=${encodeURIComponent(targetEventStartsAt)}`:''}`}>Stadium reservation ↗</a>}
                    {isExtensionCapabilityAvailable('volunteerShifts') && <a target="_blank" rel="noopener noreferrer" href={`/volunteering?eventId=${targetEventId}&view=manage`}>Volunteer shifts ↗</a>}
                </div>}
                <nav className="schedule-compose-steps" aria-label={t('schedule.editor.editorSteps')}>
                    {STEPS.map((label, index) => (
                        <button
                            type="button"
                            key={label}
                            disabled={busy}
                            aria-current={step === index ? 'step' : undefined}
                            className={step === index ? 'active' : step > index ? 'visited' : ''}
                            onClick={() => {
                                const problem = index > step ? issue(index - 1) : null;
                                if (problem) showIssue(problem); else navigateStep(index);
                            }}
                        >
                            <span>{step > index ? <Check size={15} /> : index + 1}</span>
                            <strong>{label}</strong>
                            {index < 2 && <ChevronRight size={15} />}
                        </button>
                    ))}
                </nav>
                <div className="schedule-compose-body" ref={content}>
                    {startedSeries && (
                        <div className="schedule-compose-notice" role="status">
                            <Lock size={18} />
                            <p>
                                <Trans i18nKey="schedule.editor.startedSeriesNotice" components={{ strong: <strong /> }} />
                            </p>
                        </div>
                    )}
                    {savedSeries && !startedSeries && (
                        <div className="schedule-compose-notice">
                            <Repeat2 size={18} />
                            <p>
                                <Trans i18nKey="schedule.editor.wholeSeriesNotice" components={{ strong: <strong /> }} />
                            </p>
                        </div>
                    )}
                    {error && (
                        <div className="schedule-compose-error" role="alert">
                            {error}
                        </div>
                    )}
                    <div className="schedule-compose-columns">
                        <fieldset disabled={readOnly} className="schedule-compose-fields">
                            <section className="schedule-compose-card">
                                <header>
                                    <span className="schedule-compose-number">0{step + 1}</span>
                                    <div>
                                        <h3 ref={stepHeading} tabIndex={-1}>
                                            {step === 0
                                                ? t('schedule.editor.whatPlanning')
                                                : step === 1
                                                  ? recurring
                                                      ? t('schedule.editor.weeklyRhythm')
                                                      : t('schedule.editor.setTimePlace')
                                                  : t('schedule.editor.readyForCalendar')}
                                        </h3>
                                        <p>
                                            {step === 0
                                                ? t('schedule.editor.planHint')
                                                : step === 1
                                                  ? recurring
                                                      ? t('schedule.editor.weeklyHint')
                                                      : t('schedule.editor.singleTimeHint')
                                                  : t('schedule.editor.reviewHint')}
                                        </p>
                                    </div>
                                </header>
                                <div className="schedule-compose-card-body">
                                    {step === 0 && (
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
                                    )}
                                    {step === 1 && (
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
                                    )}
                                    {step === 2 && (
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
                                    )}
                                </div>
                            </section>
                        </fieldset>
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
                    </div>
                </div>
                <footer className="schedule-compose-footer">
                    <p>
                        {startedSeries
                            ? t('schedule.editor.seriesReadOnly')
                            : savedSeries
                              ? t('schedule.editor.wholeSeries')
                              : recurring && !audience?.privateInvitations
                                ? t('schedule.editor.routineFooter')
                                : isClub
                                  ? t('schedule.editor.savingTo', { club: subjectLabel })
                                  : t('schedule.editor.savingPrivate')}
                    </p>
                    <div>
                        {canCancel && (
                            <button
                                type="button"
                                className="schedule-compose-button danger"
                                disabled={busy}
                                onClick={() => setCancelConfirm(true)}
                            >
                                <Ban size={15} />
                                {savedSeries ? t('schedule.editor.cancelSeries') : t('schedule.editor.cancelEvent')}
                            </button>
                        )}
                        <button
                            type="button"
                            className="schedule-compose-button"
                            disabled={busy}
                            onClick={requestClose}
                        >
                            {startedSeries ? t('schedule.editor.close') : t('schedule.event.cancel')}
                        </button>
                        {step > 0 && (
                            <button
                                type="button"
                                className="schedule-compose-button"
                                disabled={busy}
                                onClick={() => navigateStep(step - 1)}
                            >
                                <ChevronLeft size={15} />
                                {t('schedule.event.back')}
                            </button>
                        )}
                        {step < 2 ? (
                            <button
                                type="button"
                                className="schedule-compose-button primary"
                                disabled={busy}
                                onClick={startedSeries ? () => navigateStep(step + 1) : next}
                            >
                                {t('schedule.event.continue')}
                                <ChevronRight size={16} />
                            </button>
                        ) : (
                            !startedSeries && (
                                <button
                                    type="button"
                                    className="schedule-compose-button primary"
                                    disabled={busy || !!audience && !audience.ready}
                                    onClick={() => void handleSave()}
                                >
                                    {busy ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}{' '}
                                    {submitting ? t('schedule.editor.saving') : saveLabel}
                                </button>
                            )
                        )}
                    </div>
                </footer>
            </div>
            <ConfirmDialog
                open={discard}
                title={t('schedule.event.discardEvent')}
                message={t('schedule.event.discardConfirm')}
                confirmLabel={t('schedule.event.discard')}
                cancelLabel={t('schedule.editor.keepEditing')}
                variant="warning"
                onConfirm={() => {
                    if (!inFlight.current) {
                        setDiscard(false);
                        onClose();
                    }
                }}
                onCancel={() => setDiscard(false)}
            />
            <ConfirmDialog
                open={cancelConfirm}
                title={savedSeries ? t('schedule.editor.cancelSeriesTitle') : t('schedule.editor.cancelEventTitle')}
                message={
                    savedSeries
                        ? t('schedule.editor.cancelSeriesMessage')
                        : t('schedule.editor.cancelEventMessage')
                }
                confirmLabel={savedSeries ? t('schedule.editor.cancelSeries') : t('schedule.editor.cancelEvent')}
                cancelLabel={t('schedule.editor.keepEvent')}
                variant="danger"
                onConfirm={() => {
                    setCancelConfirm(false);
                    void handleCancel();
                }}
                onCancel={() => setCancelConfirm(false)}
            />
        </div>
    );
};
