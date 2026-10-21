import { ArrowLeft, X } from 'lucide-react';
import { Badge, Button, EmptyNote, FixtureRow, List, Section, Skeleton } from '../../../design/primitives';
import type { FamilyPlan } from '../api';
import { stopClock, type ItineraryStop } from '../planner/itinerary';
import { FamilyReply } from './FamilyReply';
import { JourneyView } from './JourneyView';
import type { FamilyJourneysState } from './useFamilyJourneys';

const STATUS: Record<string, string> = { GOING: 'Going', NOT_GOING: 'Not going', RECONFIRMATION_REQUIRED: 'Confirm the update' };

/**
 * Journeys shared with a family or a player: every published journey with its reply
 * status, and the selected one in full with going, read and permission answers.
 */
export function FamilyJourneys({ journeys, selected, onOpen, stop, onStop, onExit, canPlan, onPlan, missing = false }: {
    journeys: FamilyJourneysState; selected: FamilyPlan | null; onOpen: (journey: FamilyPlan | null) => void;
    stop: string | null; onStop: (stop: ItineraryStop | null) => void; onExit: () => void; canPlan: boolean; onPlan: () => void;
    /** The link named a journey that is not among these; never show another one in its place. */
    missing?: boolean;
}) {
    if (selected) return (
        <JourneyView itinerary={selected.itinerary} selected={stop} onSelect={onStop}
            heading={<div className="gk-plan-head gk-plan-head--inline">
                <div className="gk-plan-head__nav"><Button size="sm" variant="ghost" onClick={() => onOpen(null)}><ArrowLeft aria-hidden="true" />Your journeys</Button></div>
                <h2 className="gk-plan-head__title">{selected.title}</h2>
                <div className="gk-row gk-plan-head__meta"><Badge tone="accent">Version {selected.version}</Badge><span className="gk-faint">{selected.club_name} · for {selected.child_name}</span></div>
            </div>}>
            {journeys.actionError && <div className="gk-notice gk-notice--danger" role="alert">{journeys.actionError}</div>}
            <FamilyReply journey={selected} busy={journeys.busy} act={journeys.act} />
        </JourneyView>
    );
    const sorted = [...journeys.items].sort((a, b) => Date.parse(a.itinerary.startsAt) - Date.parse(b.itinerary.startsAt));
    return (
        <div className="gk-plan-body">
            <div className="gk-plan-head gk-plan-head--inline">
                <div className="gk-plan-head__nav">
                    {canPlan ? <Button size="sm" variant="ghost" onClick={onPlan}><ArrowLeft aria-hidden="true" />Planning</Button> : <span />}
                    <Button size="sm" variant="ghost" iconOnly aria-label="Close journeys" onClick={onExit}><X aria-hidden="true" /></Button>
                </div>
                <h2 className="gk-plan-head__title">Your journeys</h2>
                <p className="gk-faint">Shared by your club. Read the day, then reply here.</p>
            </div>
            {missing && <div className="gk-notice gk-notice--warning" role="status">That journey is not available. It may have been withdrawn, or it was shared with another account.</div>}
            {journeys.loading ? <Skeleton height={72} /> : journeys.error ? (
                <div className="gk-notice gk-notice--danger" role="alert"><span className="gk-world-grow">{journeys.error}</span><Button size="sm" onClick={journeys.refresh}>Try again</Button></div>
            ) : sorted.length ? (
                <Section title="Coming up">
                    <List label="Your journeys" className="gk-plan-list">
                        {sorted.map(journey => {
                            const clock = stopClock(journey.itinerary.startsAt, journey.itinerary.timezone);
                            return <FixtureRow key={journey.id} tone="event" time={clock.time} day={clock.day} title={journey.title} onClick={() => onOpen(journey)} label={`Open ${journey.title}`}
                                meta={`${journey.club_name} · ${journey.child_name} · ${journey.itinerary.destination || journey.itinerary.meetingPoint}`}
                                trail={<Badge tone={journey.response?.status === 'GOING' ? 'accent' : journey.response?.status === 'NOT_GOING' ? 'danger' : 'warning'}>{STATUS[journey.response?.status ?? ''] ?? 'Reply needed'}</Badge>} />;
                        })}
                    </List>
                </Section>
            ) : <EmptyNote title="No journeys shared with you yet">When your club publishes a journey for you or your child, it appears here and in your schedule. Staff notes and drafts are never shared.</EmptyNote>}
        </div>
    );
}
