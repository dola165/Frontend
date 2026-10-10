import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Badge, Button } from '../../../design/primitives';
import { Segmented } from '../../../design/Tabs';
import { MapPanel } from '../../world/map/sheet/MapPanel';
import type { SheetSnap } from '../../world/map/sheet/usePhoneLayout';
import { FamilyJourneys } from '../journey/FamilyJourneys';
import { JourneyView } from '../journey/JourneyView';
import { PlanEditorBody, PlanHeading } from './PlanEditor';
import { PlanStart } from './PlanStart';
import { PlacePicker } from './PlacePicker';
import type { Planner } from './usePlanner';
import './planner.css';

/**
 * Planning beside the map: the journeys home, the plan editor, a family's-eye preview and
 * the journeys shared with you. A docked panel on wide screens, a sheet on phones.
 */
export function PlannerPanel({ planner }: { planner: Planner }) {
    const { mode, editor, planMap, family } = planner;
    const [snap, setSnap] = useState<SheetSnap>('half');
    const shownSnap: SheetSnap = planMap.pick || planMap.candidate ? 'peek' : snap;
    const selectStop = (stop: { id: string; place: { latitude: number; longitude: number } | null } | null) => {
        planMap.selectStop(stop?.id ?? null);
        if (stop?.place) planMap.focus(stop.place);
    };
    let header = null, body;
    if (mode === 'family') {
        body = <FamilyJourneys journeys={family} selected={planner.selectedJourney} onOpen={planner.openJourney} stop={planMap.selectedStop} onStop={selectStop}
            onExit={editor.exit} canPlan={planner.canPlan} onPlan={planner.toStaff} missing={planner.missingJourney} />;
    } else if (mode === 'preview' && planner.preview) {
        const published = Boolean(editor.plan?.published);
        body = (
            <JourneyView itinerary={planner.preview} selected={planMap.selectedStop} onSelect={selectStop}
                heading={<div className="gk-plan-head gk-plan-head--inline">
                    <div className="gk-plan-head__nav">
                        <Button size="sm" variant="ghost" onClick={() => planner.setPreview(null)}><ArrowLeft aria-hidden="true" />Back to planning</Button>
                    </div>
                    <h2 className="gk-plan-head__title">{planner.preview.title || 'Untitled journey'}</h2>
                    {published
                        ? <Segmented label="Which version" value={planner.view === 'journey' ? 'journey' : 'draft'} onChange={value => planner.setPreview(value)}
                            items={[{ id: 'journey', label: `Shared · version ${editor.plan?.published_version}` }, { id: 'draft', label: 'Current draft' }]} />
                        : <div className="gk-row gk-plan-head__meta"><Badge>Draft, as families would see it</Badge></div>}
                </div>} />
        );
    } else if (mode === 'edit') {
        header = editor.draft ? <PlanHeading editor={editor} onPreview={() => planner.setPreview(editor.plan?.published ? 'journey' : 'draft')} /> : null;
        body = <PlanEditorBody editor={editor} planMap={planMap} onPreview={planner.setPreview} pendingPlace={planner.pendingPlace} onPendingDone={planner.clearPending} />;
    } else {
        header = (
            <div className="gk-plan-head">
                <div className="gk-plan-head__nav"><Button size="sm" variant="ghost" onClick={editor.exit}><ArrowLeft aria-hidden="true" />Map</Button></div>
                <h2 className="gk-plan-head__title">Journeys</h2>
                <p className="gk-faint">Away days, tournaments and trips. Families see a journey once you publish it.</p>
            </div>
        );
        body = <PlanStart editor={editor} familyHref="/world/map?plans=family" pendingPlace={planner.pendingPlace} onPendingDone={planner.clearPending} />;
    }
    return (
        <>
            <MapPanel label="Journey planning" variant="docked" header={header} snap={shownSnap} onSnap={setSnap} className={mode === 'edit' ? 'gk-plan-panel gk-plan-panel--editor' : 'gk-plan-panel'}>
                {body}
            </MapPanel>
            {mode === 'edit' && <PlacePicker planMap={planMap} />}
        </>
    );
}
