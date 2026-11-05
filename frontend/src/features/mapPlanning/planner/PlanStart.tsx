import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Badge, Button, ButtonLink, EmptyNote, FixtureRow, List, Section, Skeleton } from '../../../design/primitives';
import { recoverPlan, recoverSelection } from '../draftRecovery';
import type { PlanContext, PlanPlace } from '../api';
import { FromFixtureDialog, type FixtureChoice } from './FromFixtureDialog';
import { stopClock } from './itinerary';
import type { PlanEditor } from './usePlanEditor';

const FALLBACK_ZONE = 'Asia/Tbilisi';
const FIRST_FIXTURES = 4;

/** "v Telavi Valley FC" and which side we are, from a fixture title such as "Telavi Valley FC vs FC Dinamo". */
function fixtureName(title: string, club: string) {
    const [home, away] = title.split(' vs ');
    if (away === club) return { title: `v ${home}`, side: 'Away' };
    if (home === club && away) return { title: `v ${away}`, side: 'Home' };
    return { title, side: '' };
}

function upcomingFixtures(context: PlanContext) {
    const mine = new Set(context.squads.filter(squad => squad.canEdit).map(squad => squad.id));
    const now = Date.now();
    return context.events
        .filter(event => Date.parse(event.ends_at) > now && (mine.has(event.challenger_squad_id) || mine.has(event.target_squad_id)))
        .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
        .map(event => ({ event, choices: context.squads.filter(squad => squad.canEdit && (squad.id === event.challenger_squad_id || squad.id === event.target_squad_id)).map((squad): FixtureChoice => ({ squadId: squad.id, clubId: context.id, name: squad.name })) }));
}

/**
 * Journeys home: plan from a coming fixture, start a blank plan, or open a saved journey.
 * People without a planning responsibility see their own shared journeys instead.
 */
export function PlanStart({ editor, familyHref, pendingPlace, onPendingDone }: { editor: PlanEditor; familyHref: string; pendingPlace: PlanPlace | null; onPendingDone: () => void }) {
    const { contexts, context, plans } = editor;
    const [fixture, setFixture] = useState<{ eventId: number; title: string; choices: FixtureChoice[] } | null>(null);
    const blankId = useId();
    const editable = context?.squads.filter(squad => squad.canEdit) ?? [];
    const [blankSquad, setBlankSquad] = useState(0);
    const [allFixtures, setAllFixtures] = useState(false);
    const zone = context?.settings.timezone || FALLBACK_ZONE;
    // Work this device kept: a new draft never created, or changes to a saved plan not yet saved.
    const unsaved = recoverPlan();
    const lastOpened = recoverSelection()?.planId ?? 0;
    const squadName = (id: number) => context?.squads.find(squad => squad.id === id)?.name ?? 'Squad';

    if (editor.loading || !contexts) return (
        <div className="gk-plan-body" role="status" aria-label="Loading journeys"><Skeleton height={28} width="40%" /><Skeleton height={72} /><Skeleton height={72} /><Skeleton height={72} /></div>
    );
    if (!contexts.length) return (
        <div className="gk-plan-body">
            <EmptyNote title={editor.contextError ? 'Your planning access could not load' : 'You don’t plan journeys for a squad'}
                action={<ButtonLink variant="primary" size="sm" to={familyHref}>Journeys shared with you</ButtonLink>}>
                {editor.contextError || 'Coaches and staff with a travel or match responsibility plan journeys here. Journeys your club shares with you are one click away.'}
            </EmptyNote>
            <Link className="gk-section__action" to="/requests">Review my club responsibilities</Link>
        </div>
    );
    const fixtures = context ? upcomingFixtures(context) : [];
    return (
        <div className="gk-plan-body">
            {contexts.length > 1 && (
                <label className="gk-plan-inline">
                    <span className="gk-faint">Club</span>
                    <select className="gk-input" value={editor.club} onChange={event => editor.selectClub(Number(event.target.value))}>
                        {contexts.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                </label>
            )}
            {pendingPlace && (
                <div className="gk-notice gk-plan-resume" role="status">
                    <span className="gk-world-grow">Open a journey to save <strong>{pendingPlace.name}</strong> to it, or start a new plan.</span>
                    <Button size="sm" variant="ghost" onClick={onPendingDone}>Not now</Button>
                </div>
            )}
            {unsaved && unsaved.clubId === editor.club && (
                <div className="gk-notice gk-notice--warning gk-plan-resume" role="status">
                    <span className="gk-world-grow"><strong>{unsaved.planId ? 'Unsaved changes:' : 'Unsaved draft:'}</strong> {unsaved.draft.title || 'Untitled journey'} · {squadName(unsaved.squadId)}</span>
                    <Button size="sm" onClick={() => unsaved.planId
                        ? editor.open({ id: unsaved.planId, club_id: unsaved.clubId, squad_id: unsaved.squadId })
                        : editor.resume(unsaved.requestId, unsaved.clubId, unsaved.squadId)}>Continue</Button>
                </div>
            )}
            <Section title="Your journeys" hint={plans?.length ? `${plans.length}` : undefined}>
                {plans === null ? <Skeleton height={72} /> : plans.length ? (
                    <List label="Saved journeys" className="gk-plan-list">
                        {[...plans].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)).map(plan => {
                            const clock = stopClock(plan.starts_at, zone);
                            const changed = plan.published_version > 0 && plan.published_revision != null && plan.revision > plan.published_revision;
                            return (
                                <FixtureRow key={plan.id} tone={plan.published_version ? 'event' : 'neutral'} time={clock.time} day={clock.day} title={plan.title}
                                    meta={[squadName(plan.squad_id), plan.id === lastOpened ? 'Last opened' : null].filter(Boolean).join(' · ')} onClick={() => editor.open(plan)} label={`Open ${plan.title}`}
                                    trail={plan.published_version
                                        ? <Badge tone={changed ? 'warning' : 'accent'}>{changed ? 'Changed' : `Shared · v${plan.published_version}`}</Badge>
                                        : <Badge>Draft</Badge>} />
                            );
                        })}
                    </List>
                ) : <EmptyNote title="No journeys yet">Plan one from a fixture below, or start a blank plan for a tournament, camp or trip.</EmptyNote>}
            </Section>
            <Section title="Plan from a fixture" hint={fixtures.length ? `${fixtures.length} coming up` : undefined}
                action={fixtures.length > FIRST_FIXTURES ? <Button size="sm" variant="ghost" aria-expanded={allFixtures} onClick={() => setAllFixtures(!allFixtures)}>{allFixtures ? 'Show fewer' : 'Show all'}</Button> : undefined}>
                {fixtures.length ? (
                    <List label="Coming fixtures" className="gk-plan-list">
                        {(allFixtures ? fixtures : fixtures.slice(0, FIRST_FIXTURES)).map(({ event, choices }) => {
                            const clock = stopClock(event.starts_at, zone);
                            const named = fixtureName(event.title, context?.name ?? '');
                            return (
                                <FixtureRow key={event.id} tone="match" time={clock.time} day={clock.day} title={named.title}
                                    meta={[choices.map(item => item.name).join(' / '), named.side, event.location_name].filter(Boolean).join(' · ')}
                                    trail={<Button size="sm" aria-label={`Plan the journey for ${event.title}`} onClick={() => setFixture({ eventId: event.id, title: event.title, choices })}>Plan journey</Button>} />
                            );
                        })}
                    </List>
                ) : <EmptyNote title="No fixtures coming up">When a match is agreed for one of your squads, plan its journey from here.</EmptyNote>}
            </Section>
            {editable.length > 0 && (
                <Section title="Start a blank plan" hint="For a tournament, a camp or a trip">
                    <div className="gk-plan-inline">
                        <label htmlFor={blankId} className="gk-visually-hidden">Squad</label>
                        <select id={blankId} className="gk-input" value={blankSquad || editable[0].id} onChange={event => setBlankSquad(Number(event.target.value))}>
                            {editable.map(squad => <option key={squad.id} value={squad.id}>{squad.name}</option>)}
                        </select>
                        <Button onClick={() => editor.start(editor.club, blankSquad || editable[0].id)}><Plus aria-hidden="true" />Start a plan</Button>
                    </div>
                </Section>
            )}
            <Link className="gk-section__action" to={familyHref}>Journeys shared with you</Link>
            {fixture && <FromFixtureDialog eventId={fixture.eventId} title={fixture.title} choices={fixture.choices} onClose={() => setFixture(null)}
                onCreated={plan => { setFixture(null); editor.refreshList(); editor.open(plan); }} />}
        </div>
    );
}
