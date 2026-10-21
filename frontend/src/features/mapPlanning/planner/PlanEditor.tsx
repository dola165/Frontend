import { useEffect, useRef } from 'react';
import { ArrowLeft, Eye, RefreshCw, X } from 'lucide-react';
import { Badge, Button, Skeleton } from '../../../design/primitives';
import { Dialog } from '../../../design/Dialog';
import { Tabs } from '../../../design/Tabs';
import { useUrlTab } from '../../../design/useUrlTab';
import { dateTime } from '../api';
import { familyChanges } from './changes';
import { CostsTab } from './CostsTab';
import { ItineraryTab } from './ItineraryTab';
import { NotesTab } from './NotesTab';
import { ShareTab } from './ShareTab';
import { TravellersTab } from './TravellersTab';
import type { PlanEditor as Editor } from './usePlanEditor';
import type { PlanMap } from './usePlanMap';
import type { PlanPlace } from '../api';

const STEPS = ['itinerary', 'people', 'notes', 'costs', 'share'] as const;
type Step = typeof STEPS[number];

/** The plan header: name, status and when, with the way back to every journey. */
export function PlanHeading({ editor, onPreview }: { editor: Editor; onPreview: () => void }) {
    const { plan, draft, context, squad } = editor;
    const changes = plan && plan.published_version ? familyChanges(plan.published, draft!).length : 0;
    const squadName = context?.squads.find(item => item.id === squad)?.name;
    return (
        <div className="gk-plan-head">
            <div className="gk-plan-head__nav">
                <Button size="sm" variant="ghost" onClick={editor.home}><ArrowLeft aria-hidden="true" />Journeys</Button>
                <div className="gk-row">
                    {plan && <Button size="sm" variant="ghost" iconOnly aria-label="Reload the saved plan" title="Reload the saved plan" onClick={editor.reload}><RefreshCw aria-hidden="true" /></Button>}
                    {draft && <Button size="sm" variant="ghost" onClick={onPreview}><Eye aria-hidden="true" />Preview</Button>}
                    <Button size="sm" variant="ghost" iconOnly aria-label="Close planning" title="Close planning" onClick={editor.exit}><X aria-hidden="true" /></Button>
                </div>
            </div>
            <h2 className="gk-plan-head__title">{draft?.title || 'New journey'}</h2>
            <div className="gk-row gk-plan-head__meta">
                {!plan ? <Badge>Not saved</Badge> : plan.published_version ? <Badge tone="accent">Shared · version {plan.published_version}</Badge> : <Badge>Private draft</Badge>}
                {changes > 0 && <Badge tone="warning">{changes} {changes === 1 ? 'change' : 'changes'} not shared</Badge>}
                {editor.dirty && <Badge tone="warning">Unsaved</Badge>}
                <span className="gk-faint">{[squadName, draft && dateTime(draft.startsAt, draft.timezone)].filter(Boolean).join(' · ')}</span>
            </div>
        </div>
    );
}

/**
 * Editing a journey: itinerary, who travels, kit and notes, costs, and sharing, with a save
 * bar that always says where the work is. Leaving with unsaved work asks first.
 */
export function PlanEditorBody({ editor, planMap, onPreview, pendingPlace, onPendingDone }: {
    editor: Editor; planMap: PlanMap; onPreview: (source: 'draft' | 'journey') => void; pendingPlace: PlanPlace | null; onPendingDone: () => void;
}) {
    const { plan, draft, context, squad, canEdit, busy } = editor;
    const [step, setStep] = useUrlTab<Step>('step', STEPS, 'itinerary');
    const root = useRef<HTMLDivElement>(null);
    const { validation } = editor;
    useEffect(() => {
        if (!validation) return;
        if (validation.field === 'Plan name' || validation.field === 'Leaving' || validation.field === 'Expected return' || validation.field === 'Schedule') setStep('itinerary');
        requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(`[aria-label="${validation.field}"]`)?.focus());
        // Focus follows a new validation message only.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [validation]);
    // The chosen section stays in view when the tabs are wider than the panel.
    const opened = Boolean(draft);
    useEffect(() => { root.current?.querySelector('.gk-plan-tabs [aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); }, [step, opened]);
    // "Add as a stop" from the map lands on the itinerary, where the new stop opens.
    const { seed } = planMap;
    useEffect(() => { if (seed && step !== 'itinerary') setStep('itinerary'); }, [seed]); // eslint-disable-line react-hooks/exhaustive-deps
    if (!draft) return <div className="gk-plan-body" role="status" aria-label="Opening the plan"><Skeleton height={44} /><Skeleton height={72} /><Skeleton height={72} /></div>;
    const save = () => {
        const invalid = root.current?.querySelector<HTMLInputElement>('input[data-plan-time][aria-invalid="true"]');
        if (invalid) { invalid.focus(); return; }
        void editor.persist();
    };
    const command = (path: string, extra?: Record<string, unknown>) => editor.command(path, extra);
    const status = busy === 'creating' ? 'Creating your plan…' : busy === 'saving' ? 'Saving…' : busy === 'working' ? 'Updating…'
        : editor.error ? 'Not saved. Your changes are kept.' : editor.notice || (editor.dirty ? 'Unsaved changes, kept on this device' : plan ? 'Saved to your club' : 'Name the plan to create it');
    return (
        <div className="gk-plan-editor-root" ref={root} data-plan-editor>
            <Tabs label="Plan sections" value={step} onChange={setStep} className="gk-plan-tabs"
                items={[{ id: 'itinerary', label: 'Itinerary' }, { id: 'people', label: 'Travelling', count: draft.participants.length || undefined }, { id: 'notes', label: 'Kit and notes' }, { id: 'costs', label: 'Costs' }, { id: 'share', label: 'Share' }]} />
            <div className="gk-plan-scroll">
                {editor.created && (
                    <div className="gk-notice gk-plan-created" role="status">
                        <span className="gk-world-grow"><strong>Plan created.</strong> It stays private to the planning staff until you publish it.</span>
                        <Button size="sm" variant="ghost" iconOnly aria-label="Dismiss" onClick={editor.dismissCreated}><X aria-hidden="true" /></Button>
                    </div>
                )}
                {editor.error && (
                    <div className="gk-notice gk-notice--danger gk-plan-alert" role="alert">
                        <span className="gk-world-grow">{editor.error}</span>
                        {plan && <Button size="sm" onClick={editor.reload}>Reload the saved plan</Button>}
                    </div>
                )}
                {pendingPlace && canEdit && (
                    <div className="gk-notice gk-plan-resume" role="status">
                        <span className="gk-world-grow">Save <strong>{pendingPlace.name}</strong> to this plan?</span>
                        <Button size="sm" variant="primary" onClick={() => { if (editor.addPlace(pendingPlace)) { planMap.focus(pendingPlace); onPendingDone(); } }}>Save place</Button>
                        <Button size="sm" variant="ghost" onClick={onPendingDone}>Not now</Button>
                    </div>
                )}
                {!canEdit && <div className="gk-notice" role="status">You can read this plan. Editing needs a planning responsibility for this squad.</div>}
                {step === 'itinerary' && <ItineraryTab draft={draft} plan={plan} context={context} squad={squad} busy={Boolean(busy) || editor.dirty} canEdit={canEdit} planMap={planMap} change={editor.change} validation={validation} onCalendar={key => void command('calendar-event', { activityKey: key })} />}
                {step === 'people' && <TravellersTab draft={draft} plan={plan} context={context} squad={squad} canEdit={canEdit} busy={Boolean(busy) || editor.dirty} change={editor.change} command={command} />}
                {step === 'notes' && <NotesTab draft={draft} canEdit={canEdit} change={editor.change} />}
                {step === 'costs' && <CostsTab draft={draft} plan={plan} context={context} squad={squad} canEdit={canEdit} busy={Boolean(busy)} dirty={editor.dirty} change={editor.change} command={command} />}
                {step === 'share' && <ShareTab draft={draft} plan={plan} dirty={editor.dirty} busy={Boolean(busy)} command={command} received={editor.received} onPreview={onPreview} />}
            </div>
            <footer className="gk-plan-savebar">
                <p role="status" className="gk-plan-savebar__status">
                    <span>{status}</span>
                    {editor.recoveryWarning && <small>{editor.recoveryWarning}</small>}
                    {plan && !editor.dirty && !busy && <small>Revision {plan.revision}{plan.published_version ? ` · families have version ${plan.published_version}` : ''}</small>}
                </p>
                {canEdit && (!plan || editor.dirty || busy === 'saving') && <Button variant="primary" onClick={save} disabled={Boolean(busy)} aria-busy={busy === 'saving' || busy === 'creating'}>
                    {busy === 'creating' ? 'Creating…' : busy === 'saving' ? 'Saving…' : plan ? 'Save changes' : 'Create plan'}
                </Button>}
            </footer>
            <Dialog open={Boolean(editor.pending)} role="alertdialog" size="sm" title="Keep your changes?" description="This plan has changes that have not reached your club yet." onClose={() => editor.setPending(null)}
                footer={<>
                    <Button variant="ghost" onClick={() => editor.setPending(null)}>Keep editing</Button>
                    <Button onClick={() => { const next = editor.pending; editor.discard(); editor.setPending(null); next?.(); }}>Discard changes</Button>
                    <Button variant="primary" disabled={Boolean(busy)} onClick={() => void editor.persist().then(saved => { if (saved) { const next = editor.pending; editor.setPending(null); next?.(); } })}>Save and continue</Button>
                </>} />
        </div>
    );
}
