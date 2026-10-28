import type { CSSProperties } from 'react';
import { Trans } from 'react-i18next';
import { Ban, CalendarDays, Check, ChevronLeft, ChevronRight, Loader2, Lock, Repeat2, X } from 'lucide-react';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import type { EventCreationModalProps } from './eventEditor/eventEditorModel';
import { useEventEditor } from './eventEditor/useEventEditor';
import { EventPlanStep } from './eventEditor/EventPlanStep';
import { EventWhenWhereStep } from './eventEditor/EventWhenWhereStep';
import { EventReviewStep } from './eventEditor/EventReviewStep';
import { EventPreview } from './eventEditor/EventPreview';
import './eventEditor/event-dialog.css';
import './eventEditor/event-fields.css';
import './eventEditor/event-review.css';
import './eventEditor/event-preview.css';
import './eventEditor/event-actions.css';
import './eventEditor/event-responsive.css';
import './schedule-editor-identity.css';

export type { EventCreationFormValues, ModalMode, ModalSurface } from './eventEditor/eventEditorModel';

export const EventCreationModal = (props: EventCreationModalProps) => props.isOpen ? <EventCreationContent {...props} /> : null;

const EventCreationContent = (props: EventCreationModalProps) => {
    const editor = useEventEditor(props);
    const {
        STEPS, accent, audience, audienceNotice, busy, canCancel, cancelConfirm, content, descriptionId,
        dialog, discard, error, handleCancel, handleSave, headline, inFlight, isClub, issue, motion,
        navigateStep, next, onClose, readOnly, recurring, requestClose, saveLabel, savedSeries,
        setCancelConfirm, setDiscard, showIssue, startedSeries, step, stepHeading, subjectLabel, submitting,
        t, titleId,
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
                                    {step === 0 && <EventPlanStep editor={editor} />}
                                    {step === 1 && <EventWhenWhereStep editor={editor} />}
                                    {step === 2 && <EventReviewStep editor={editor} />}
                                </div>
                            </section>
                        </fieldset>
                        <EventPreview editor={editor} />
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
