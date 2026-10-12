import { useRef, type FormEvent, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, ButtonLink, EmptyNote } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { buildLoginRedirectPath } from '../../../utils/authRedirect';
import { ageGroupOf } from '../../matchExchange/arrange/matchPlan';
import { parseDrawSeed } from '../../tournaments/create/drawDraft';
import { notifyWorldChanged } from '../cache';
import { useArrangeableSquads } from '../compose/useArrangeableSquads';
import { EntriesQuestion, PublishQuestion, RulesDetail } from '../compose/draw/DrawDetails';
import { FormatQuestion, OrganiserQuestion, PlayersQuestion, ScopeQuestion, WhenQuestion } from '../compose/draw/DrawBasics';
import { DrawPreview } from '../compose/draw/DrawPreview';
import { drawProblem, useDrawRoom } from '../compose/draw/useDrawRoom';
import { useWorldCopy } from '../copy';
import { useNow } from '../scoreboard/useNow';
import { DrawerFrame, DrawerLoading } from './DrawerFrame';
import { noteDone } from './stepNotice';
import { peekOf, usePeek } from './usePeek';
import '../compose/draw/draw.css';
import './step.css';

/** The age most of the person's squads play: the likely age of the tournament they set up. */
function likelyAge(categories: string[]) {
    const counts = new Map<string, number>();
    for (const age of categories.map(ageGroupOf).filter(Boolean) as string[]) counts.set(age, (counts.get(age) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'SENIOR';
}

/**
 * The Draw room (decision 12): creating a tournament in World's frame, from the "+" (`draw-new`, or `draw-o901.fCUP` from
 * an organisation's page). The tournament as it will be stays pinned at the top; the questions scroll, each with its
 * likely answer chosen; Create stays at the bottom with what it does. The draft is kept in the tab and continued from
 * the "+". Once created, the tournament's own pane opens.
 */
export default function DrawPeek({ id }: { id: string }) {
    const t = useWorldCopy();
    const { status } = useAuth();
    const location = useLocation();
    const squads = useArrangeableSquads();
    if (status !== 'authenticated') return (
        <DrawerFrame title={t('Create a tournament')}>
            <EmptyNote title={t('Sign in to create a tournament')} action={<ButtonLink size="sm" variant="primary" to={buildLoginRedirectPath(location.pathname, location.search, location.hash)}>{t('Sign in')}</ButtonLink>} />
        </DrawerFrame>
    );
    if (squads === undefined) return <DrawerFrame title={t('Create a tournament')}><DrawerLoading /></DrawerFrame>;
    return <DrawRoom seed={id} ageHint={likelyAge(squads.map(squad => squad.category))} />;
}

function Question({ title, children }: { title: string; children: ReactNode }) {
    return <fieldset className="gk-draw__question"><legend className="gk-field__label">{title}</legend>{children}</fieldset>;
}

function DrawRoom({ seed, ageHint }: { seed: string; ageHint: string }) {
    const t = useWorldCopy();
    const navigate = useNavigate();
    const drawers = usePeek();
    const now = useNow();
    const form = useRef<HTMLFormElement>(null);
    const room = useDrawRoom(parseDrawSeed(seed), ageHint);
    const { draft, organizerId, creatable, sending } = room;
    const problem = drawProblem(draft, organizerId, now);
    const organiser = creatable.find(organisation => organisation.id === organizerId)?.displayName;
    const created = (id: number | undefined) => {
        if (!id) return;
        notifyWorldChanged(['personal-competitions:', 'tournament-invitations:']);
        noteDone(draft.visibility === 'PRIVATE' ? t('Created. Only your organisation’s staff see it until you publish it.') : t('Created.'));
        drawers.open(peekOf('tournament', id));
    };
    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (problem) {
            form.current?.querySelector<HTMLElement>(`[data-field="${problem.field}"]`)?.closest('details')?.setAttribute('open', '');
            form.current?.querySelector<HTMLElement>(`[data-field="${problem.field}"]`)?.focus();
            return;
        }
        created((await room.create())?.id);
    };
    return (
        <DrawerFrame title={t('Create a tournament')}>
            <form ref={form} className="gk-draw" noValidate onSubmit={event => void submit(event)} aria-busy={sending.busy}>
                <DrawPreview draft={draft} organiser={organiser} />
                {room.pending && <p className="gk-step__warn">{t('An earlier Create has not been answered yet.')} <button type="button" className="gk-step__reload" onClick={() => void room.recover().then(result => created(result?.id))}>{t('Recover it')}</button></p>}
                <Question title={t('Who organises it')}><OrganiserQuestion room={room} onCreateOrganiser={() => navigate('/organizations/create?kind=TOURNAMENT_ORGANIZER', { state: { drawRoom: true } })} /></Question>
                <Question title={t('Who plays')}><PlayersQuestion room={room} /></Question>
                <Question title={t('Format and teams')}><FormatQuestion room={room} /></Question>
                <Question title={t('When and where')}><WhenQuestion room={room} /></Question>
                <Question title={t('Who enters')}><ScopeQuestion room={room} /></Question>
                <Question title={t('Entries')}><EntriesQuestion room={room} /></Question>
                <RulesDetail room={room} />
                <Question title={t('Publish')}><PublishQuestion room={room} /></Question>
                <footer className="gk-draw__foot">
                    <p className="gk-draw__next">{problem ? <span className="gk-draw__problem">{t(problem.message, problem.vars)}</span>
                        : draft.visibility === 'PRIVATE' ? t('Private. Only your organisation’s staff see it until you publish it.') : draft.visibility === 'UNLISTED' ? t('Anyone with its link sees it; it is not listed.') : t('Everyone sees it in World as soon as it is created.')}</p>
                    {sending.error && <p className="gk-step__error" role="alert">{t(sending.error)}</p>}
                    <div className="gk-draw__actions">
                        <Button variant="ghost" type="button" disabled={sending.busy} onClick={room.restart}>{t('Start again')}</Button>
                        <Button variant="primary" type="submit" disabled={sending.busy || room.pending}>{sending.busy ? t('Creating…') : t('Create the tournament')}</Button>
                    </div>
                </footer>
            </form>
        </DrawerFrame>
    );
}
