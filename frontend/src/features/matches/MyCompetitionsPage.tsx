import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronRight, Trophy } from 'lucide-react';
import { ButtonLink, EmptyNote, GkRoot, List, ListRow, PageFrame, PageHeader, Panel, Section, Skeleton } from '../../design/primitives';
import { Status } from '../../design/DataTable';
import { useAuth } from '../../context/AuthContext';
import { ActivityBadge } from '../clubWorkspace/coachHub/CoachVisuals';
import { getMatchHistory, type HistoryMatch } from '../matchHistory/api';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { matchPath } from './matchContext';
import './match-page.css';

type Competition = { id: number; name: string };
type Loaded = { coming: HistoryMatch[]; owed: HistoryMatch[] } | 'failed';

const when = (iso: string | null) => iso ? new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

/** A fixture's page: the one match page in this competition's context when it is a match, else the workspace's fixture. */
const fixturePath = (fixture: HistoryMatch, competition: number) => {
    const event = /^\/matches\/(\d+)/.exec(fixture.detailPath)?.[1];
    return event ? matchPath(Number(event), { kind: 'competition', id: competition }) : `/tournaments/${competition}/workspace?view=schedule&fixtureId=${fixture.sourceId}`;
};

/**
 * An organiser's competitions, their place in the top bar (step 6): for each, the fixtures coming up (each the one
 * match page, the same match both squads have in their week) and the results still to add, which the organiser
 * records. Running a competition (draws, tables, rules) stays in its workspace.
 */
export default function MyCompetitionsPage() {
    const copy = useJourneyCopy();
    const { user, sessionId } = useAuth();
    const [params] = useSearchParams();
    const competitions: Competition[] = (user?.navigationCapabilities?.workspaces ?? []).filter(item => item.id === 'tournament.workspace')
        .map(item => ({ id: item.context.id, name: item.context.label }));
    const focus = Number(params.get('competition')) || null;
    const shown = focus ? competitions.filter(c => c.id === focus) : competitions;
    return <GkRoot className="gk-page"><PageFrame>
        <PageHeader title={copy('My competitions', 'ჩემი შეჯიბრებები')} />
        {!competitions.length ? <EmptyNote title={copy('No competitions to run yet', 'სამართავი შეჯიბრებები ჯერ არ არის')}
            action={<ButtonLink to="/world/tournaments">{copy('Tournaments', 'ტურნირები')}</ButtonLink>}>{copy('Competitions you organise appear here.', 'თქვენ მიერ ორგანიზებული შეჯიბრებები აქ გამოჩნდება.')}</EmptyNote>
            : <div className="gk-stack">{shown.map(competition => <CompetitionFixtures key={competition.id} competition={competition} sessionId={sessionId} />)}</div>}
    </PageFrame></GkRoot>;
}

function CompetitionFixtures({ competition, sessionId }: { competition: Competition; sessionId: ReturnType<typeof useAuth>['sessionId'] }) {
    const copy = useJourneyCopy();
    const [loaded, setLoaded] = useState<Loaded>();
    useEffect(() => {
        const controller = new AbortController();
        const ask = (period: string) => getMatchHistory(`tournamentId=${competition.id}&period=${period}&size=20`, controller.signal, sessionId);
        Promise.all([ask('UPCOMING'), ask('NEEDS_RESULT')])
            .then(([coming, owed]) => { if (!controller.signal.aborted) setLoaded({ coming: coming.items, owed: owed.items }); })
            .catch(() => { if (!controller.signal.aborted) setLoaded('failed'); });
        return () => controller.abort();
    }, [competition.id, sessionId]);
    const row = (fixture: HistoryMatch, owed: boolean) => <ListRow key={fixture.id} to={fixturePath(fixture, competition.id)} lead={<ActivityBadge kind="MATCH" size={32} />}
        title={`${fixture.homeClubName ?? copy('To be decided', 'გადასაწყვეტია')} v ${fixture.awayClubName ?? copy('To be decided', 'გადასაწყვეტია')}`}
        meta={[when(fixture.startsAt), fixture.locationName].filter(Boolean).join(' · ')}
        trail={<>{owed ? <Status tone="warning">{copy('Result to add', 'შედეგი დასამატებელია')}</Status> : null}<ChevronRight className="cw-chevron" aria-hidden="true" /></>} />;
    return <Section boxed icon={Trophy} title={competition.name} action={<ButtonLink size="sm" variant="ghost" to={`/tournaments/${competition.id}/workspace`}>{copy('Workspace', 'სამუშაო სივრცე')}</ButtonLink>}>
        {loaded === undefined ? <Skeleton height={96} /> : loaded === 'failed' ? <p className="gk-notice gk-notice--danger" role="alert">{copy('The fixtures couldn’t load.', 'მატჩები ვერ ჩაიტვირთა.')}</p> : <>
            {loaded.owed.length > 0 && <Panel flush><List label={copy('Results to add', 'დასამატებელი შედეგები')}>{loaded.owed.map(fixture => row(fixture, true))}</List></Panel>}
            {loaded.coming.length ? <Panel flush><List label={copy('Coming up', 'მომავალი')}>{loaded.coming.map(fixture => row(fixture, false))}</List></Panel>
                : !loaded.owed.length && <p className="gk-faint">{copy('No fixtures coming up.', 'მომავალი მატჩები არ არის.')}</p>}
        </>}
    </Section>;
}
