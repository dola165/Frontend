import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Route } from 'lucide-react';
import { Button, GkRoot } from '../../design/primitives';
import { planGet, type PlanContext } from './api';
import { FromFixtureDialog, type FixtureChoice } from './planner/FromFixtureDialog';

/**
 * "Plan team travel" for an agreed fixture, shown wherever the fixture is (match page,
 * schedule). Offered only to staff who can plan for one of the fixture's squads.
 */
export function JourneyLauncher({ eventId }: { eventId: number }) {
    const navigate = useNavigate();
    const [contexts, setContexts] = useState<PlanContext[]>([]);
    const [open, setOpen] = useState(false);
    useEffect(() => {
        const controller = new AbortController();
        void planGet<PlanContext[]>('/context', controller.signal).then(setContexts).catch(() => undefined);
        return () => controller.abort();
    }, [eventId]);
    const fixture = contexts.flatMap(context => context.events.filter(event => event.id === eventId).map(event => ({ context, event })))[0];
    const choices: FixtureChoice[] = contexts.flatMap(context => context.events.filter(event => event.id === eventId)
        .flatMap(event => context.squads.filter(squad => squad.canEdit && (squad.id === event.challenger_squad_id || squad.id === event.target_squad_id))
            .map(squad => ({ squadId: squad.id, clubId: context.id, name: `${context.name} · ${squad.name}` }))));
    if (!choices.length || !fixture) return null;
    return (
        <GkRoot className="gk-journey-launch">
            <Button onClick={() => setOpen(true)}><Route aria-hidden="true" />Plan team travel</Button>
            {open && <FromFixtureDialog eventId={eventId} title={fixture.event.title} choices={choices} onClose={() => setOpen(false)}
                onCreated={(plan, choice) => navigate(`/world/map?plans=staff&plan=${plan.id}&club=${choice.clubId}&squad=${choice.squadId}`)} />}
        </GkRoot>
    );
}
