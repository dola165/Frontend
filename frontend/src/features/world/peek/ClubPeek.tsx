import { useId, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BadgeCheck } from 'lucide-react';
import { Button, EmptyNote, Skeleton } from '../../../design/primitives';
import { Tabs } from '../../../design/Tabs';
import { Status } from '../../../design/DataTable';
import { MediaImage } from '../../../components/ui/MediaImage';
import { useAuth } from '../../../context/AuthContext';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import { fetchClubProfile } from '../api';
import { ClubMainAction } from '../cards/ClubActions';
import { FollowButton } from '../../actions/FollowButton';
import { useClubActions } from '../cards/useClubActions';
import { plural, useWorldCopy } from '../copy';
import { Crest } from '../Crest';
import { clubTypeLabel, codeLabel } from '../format';
import { useWorldData } from '../useWorldData';
import { clubPartPage, clubParts, clubTab, loadClubExtras, type ClubExtras, type ClubPart, type PaneClub } from './club/clubPane';
import { ClubOverview, ClubPartView } from './club/ClubParts';
import { DrawerFrame, DrawerLoading } from './DrawerFrame';
import { peekClick, peekOf, usePeek, usePeekPart } from './usePeek';
import './peek.css';
import './club/club-pane.css';

/**
 * A club beside the list (or in a drawer): its cover and crest, who they are, where you stand and the one thing to do
 * for who is looking, then tabs that switch in place: an overview with a little of each part (programmes and teams,
 * coaches, management, matches, trials, jobs, venues, honours, contact), and a tab of its own for each part that has
 * something in it. The tab shown is in the address. Everything shown is what the club published; "Club page" opens
 * the full page at the tab shown.
 */
export default function ClubPeek({ id }: { id: string }) {
    const t = useWorldCopy();
    const { sessionId, status } = useAuth();
    const clubId = Number(id);
    const club = useWorldData<PaneClub>(`club:${clubId}`, signal => fetchClubProfile(clubId, signal), t('This club could not load.'));
    // The rest arrives in one go, so the pane paints once; a part that fails is left out and can be asked for again.
    const extras = useWorldData(`club-pane:${sessionId}:${clubId}:${status}`, () => loadClubExtras(clubId, sessionId, status === 'authenticated'));
    if (club.loading) return <DrawerFrame title={t('Loading…')}><DrawerLoading /></DrawerFrame>;
    if (!club.data) return (
        <DrawerFrame title={t('Club')}>
            <EmptyNote title={club.error || t('This club could not load.')} action={<Button size="sm" onClick={club.retry}>{t('Try again')}</Button>} />
        </DrawerFrame>
    );
    return <ClubPane club={club.data} extras={extras.data} retry={extras.retry} />;
}

function ClubPane({ club, extras, retry }: { club: PaneClub; extras?: ClubExtras; retry: () => void }) {
    const t = useWorldCopy();
    const drawers = usePeek();
    const [params] = useSearchParams();
    const player = params.get('player');
    const actions = useClubActions(club);
    const { standing, linked, message, child } = actions;
    const [part, showPart] = usePeekPart();
    const ids = useId();
    const tabsTop = useRef<HTMLDivElement>(null);
    const parts = extras ? clubParts(club, extras) : [];
    const current = parts.find(item => item.id === part)?.id;
    const shown = current ?? 'overview';
    /** Shows a part (none: the overview). Scrolled past the tabs, the pane goes back to them so the part starts at its top. */
    const select = (next?: ClubPart, focus = false) => {
        const top = tabsTop.current, body = top?.closest<HTMLElement>('.gk-drawer__body');
        if (top && body) body.scrollTop = Math.min(body.scrollTop, top.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop);
        showPart(next);
        // From a "View …" in the overview (which goes away), focus moves to the part's tab rather than falling to the page.
        if (focus) requestAnimationFrame(() => document.getElementById(`${ids}-${next ?? 'overview'}`)?.focus({ preventScroll: true }));
    };
    const cover = resolveMediaUrl(club.bannerUrl);
    const facts = [t(clubTypeLabel(club.type)), club.cityName || club.addressText?.split(',')[0], club.foundedYear ? t('Founded {year}', { year: club.foundedYear }) : null, club.level ? codeLabel(club.level) : null];
    const page = (current && clubPartPage(club.id, current, player)) || clubTab(club.id, undefined, {}, player);
    return (
        <DrawerFrame title={club.name} page={{ to: page, label: t('Club page') }}>
            <div className="gk-pane-top">
                <div className="gk-pane-cover">{cover && <MediaImage src={cover} alt="" />}</div>
                <header className="gk-pane-head">
                    <Crest src={club.logoUrl} name={club.name} size={64} />
                    <div>
                        <h3>{club.name}{club.isOfficial && <BadgeCheck className="gk-world-verified" aria-label={t('Verified club')} />}</h3>
                        <p>{facts.filter(Boolean).join(' · ')}</p>
                        {linked && <Link className="gk-club-pane__belongs" to={`/clubs/${linked.clubId}`} onClick={peekClick(peekOf('club', linked.clubId), drawers.open)}>
                            <Crest src={linked.logoUrl} name={linked.name} size={16} round />
                            {linked.profileKind === 'ACADEMY' ? t('Academy: {name}', { name: linked.name }) : t('Academy of {name}', { name: linked.name })}
                        </Link>}
                    </div>
                </header>
                <div className="gk-club-pane__actions">
                    <ClubMainAction club={club} actions={actions} />
                    <FollowButton subject={{ kind: 'club', id: club.id }} following={actions.following} name={club.name} size="sm" onChange={actions.setFollowing} />
                    {standing && <Status tone={standing.tone}>{t(standing.label)}</Status>}
                    <span className="gk-faint">{[plural(club.memberCount, 'member'), club.followerCount ? plural(club.followerCount, 'follower') : null].filter(Boolean).join(' · ')}</span>
                </div>
                {message && <p className={message.error ? 'gk-result-error' : 'gk-result-open'} role={message.error ? 'alert' : 'status'}>{message.text}</p>}
                {extras ? (
                    <div ref={tabsTop} className="gk-pane-parts">
                        <Tabs className="gk-pane-tabs" label={t('{club} page', { club: club.name })} idBase={ids} value={shown} onChange={id => select(id === 'overview' ? undefined : id)}
                            items={[{ id: 'overview' as const, label: t('Overview') }, ...parts.map(item => ({ id: item.id, label: t(item.label) }))]} />
                        <div role="tabpanel" id={`${ids}-${shown}-panel`} aria-labelledby={`${ids}-${shown}`} className="gk-pane-panel">
                            {current
                                ? <ClubPartView part={current} club={club} extras={extras} child={child} player={player} />
                                : <ClubOverview club={club} extras={extras} child={child} player={player} select={next => select(next, true)} />}
                        </div>
                    </div>
                ) : (
                    <div className="gk-pane-parts" aria-hidden="true">
                        <div className="gk-pane-tabs gk-tabs"><Skeleton height={14} width="70%" /></div>
                        <div className="gk-pane-sections">{[0, 1].map(column => <div key={column} className="gk-pane-section"><Skeleton height={12} width="40%" /><Skeleton height={14} /><Skeleton height={14} width="80%" /><Skeleton height={14} width="60%" /></div>)}</div>
                    </div>
                )}
                {extras?.failed && <p className="gk-faint gk-club-pane__failed">{t('Some parts of this club could not load.')} <button type="button" className="gk-pane-more" onClick={retry}>{t('Try again')}</button></p>}
            </div>
        </DrawerFrame>
    );
}
