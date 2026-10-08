import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Building2, CalendarDays, Check, ChevronLeft, ChevronRight, Compass, Loader2, Plus, Search, Shield, Trophy, UsersRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../context/AuthContext';
import { MediaImage } from '../../../components/ui/MediaImage';
import { PaginationBar } from '../../../components/ui/PaginationBar';
import { TournamentScopeBadge, TournamentStatusBadge } from '../../../components/tournaments/TournamentPresentation';
import { CompetitionVisual } from '../../competitions/CompetitionVisual';
import { formatTournamentDateRange } from '../../../components/tournaments/tournamentFormatters';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { fetchHostTournaments, fetchTournamentDiscovery, fetchTournamentHost, fetchTournamentHosts, setTournamentHostFollow } from '../api';
import type { PageResult, TournamentDiscoveryOverview, TournamentHost, TournamentParticipantScope, TournamentSummary } from '../domain';
import './tournament-discovery.css';

const useCopy = () => {
    const { i18n } = useTranslation();
    return (en: string, ka: string) => i18n.language.startsWith('ka') ? ka : en;
};

/** Native overflow supports touch, trackpads, keyboard focus and reduced motion. */
function Shelf({ title, description, children, action, className = '' }: {
    title: string; description?: string; children: ReactNode; action?: ReactNode; className?: string;
}) {
    const id = useId(), rail = useRef<HTMLDivElement>(null), copy = useCopy();
    const [edges, setEdges] = useState({ start: true, end: true });
    useEffect(() => {
        const element = rail.current;
        if (!element) return;
        const update = () => setEdges({ start: element.scrollLeft <= 2, end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 2 });
        const observer = new ResizeObserver(update);
        observer.observe(element);
        for (const child of element.children) observer.observe(child);
        element.addEventListener('scroll', update, { passive: true });
        update();
        return () => { observer.disconnect(); element.removeEventListener('scroll', update); };
    }, [children]);
    const move = (direction: number) => rail.current?.scrollBy({
        left: direction * rail.current.clientWidth * .85,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
    return <section className={`td-section ${className}`} aria-labelledby={id}>
        <div className="td-section-heading"><div><h2 id={id}>{title}</h2>{description && <p>{description}</p>}</div>
            <div className="td-section-actions">{action}<div className="td-scroll-controls">
                <button aria-label={`${copy('Previous', 'წინა')} ${title}`} disabled={edges.start} onClick={() => move(-1)}><ChevronLeft size={17}/></button>
                <button aria-label={`${copy('Next', 'შემდეგი')} ${title}`} disabled={edges.end} onClick={() => move(1)}><ChevronRight size={17}/></button>
            </div></div>
        </div><div className="td-rail" ref={rail}>{children}</div>
    </section>;
}

function EventMeta({ event }: { event: TournamentSummary }) {
    const { t, i18n } = useTranslation(), copy = useCopy();
    return <div className="td-event-meta"><span><CalendarDays size={14}/>{formatTournamentDateRange(event.startDate, event.endDate, i18n.language) || t('tournaments.public.datesToBeConfirmed')}</span>
        <span><UsersRound size={14}/>{copy(`${event.entryCount} ${event.entryCount === 1 ? 'entry' : 'entries'}`, `${event.entryCount} მონაწილე`)}</span></div>;
}

function CompetitionCard({ event, featured = false }: { event: TournamentSummary; featured?: boolean }) {
    const copy = useCopy();
    return <article className={`td-competition ${featured ? 'td-competition--featured' : ''}`}>
        <Link className="td-competition-art" aria-label={`${copy('View', 'ნახვა')} ${event.name}`} to={`/tournaments/${event.id}`}>
            <CompetitionVisual id={event.id} name={event.name} imageUrl={event.bannerImageUrl}/>
        </Link>
        <div className="td-competition-body"><div className="td-event-badges"><TournamentStatusBadge status={event.status}/><TournamentScopeBadge scope={event.participantScope}/></div>
            <h3><Link to={`/tournaments/${event.id}`}>{event.name}</Link></h3>
            <EventMeta event={event}/>
            <p className="td-host-line"><Shield size={14}/>{event.hostClubName || event.organizerName || copy('Organizer to be confirmed', 'ორგანიზატორი დასაზუსტებელია')}</p>
            {featured && <Link className="tw-primary td-event-cta" to={`/tournaments/${event.id}`}>{copy('Explore tournament', 'ტურნირის ნახვა')}<ArrowRight size={16}/></Link>}
        </div>
    </article>;
}

function HostIdentity({ host }: { host: TournamentHost }) {
    const [failed, setFailed] = useState(false), copy = useCopy();
    return <><span className={`td-host-logo td-host-logo--${host.kind.toLowerCase()}`}>
        {host.logoUrl && !failed ? <MediaImage src={resolveMediaUrl(host.logoUrl)} alt="" onError={() => setFailed(true)}/> : <span aria-hidden="true">{host.name.trim().slice(0, 2).toUpperCase() || 'GK'}</span>}
    </span><strong>{host.name}</strong><small>{copy(host.kind === 'CLUB' ? 'Club' : 'Organization', host.kind === 'CLUB' ? 'კლუბი' : 'ორგანიზაცია')} · {copy(`${host.tournamentCount} ${host.tournamentCount === 1 ? 'tournament' : 'tournaments'}`, `${host.tournamentCount} ტურნირი`)}</small></>;
}

export function HostCard({ host, onOpen, onChange }: { host: TournamentHost; onOpen?: (host: TournamentHost) => void; onChange: (host: TournamentHost) => void }) {
    const { isAuthenticated } = useAuth(), copy = useCopy();
    const [pending, setPending] = useState(false), [error, setError] = useState('');
    const follow = async () => {
        setPending(true); setError('');
        try { const result = await setTournamentHostFollow(host.kind, host.id, !host.following); onChange({ ...host, following: result.following }); }
        catch (err) { setError(extractApiErrorMessage(err, copy('Could not save this follow. Please try again.', 'გამოწერის შენახვა ვერ მოხერხდა. სცადეთ ხელახლა.'))); }
        finally { setPending(false); }
    };
    return <article className="td-host-card">{onOpen ? <button className="td-host-open" onClick={() => onOpen(host)} aria-label={`${copy('Tournaments by', 'ტურნირები:')} ${host.name}`}><HostIdentity host={host}/></button> : <div className="td-host-open"><HostIdentity host={host}/></div>}
        {isAuthenticated ? <button className={`td-follow ${host.following ? 'is-following' : ''}`} aria-label={`${copy(host.following ? 'Unfollow' : 'Follow', host.following ? 'გამოწერის გაუქმება:' : 'გამოწერა:')} ${host.name} ${copy('for tournaments', 'ტურნირებისთვის')}`} aria-pressed={host.following} disabled={pending} onClick={follow}>
            {pending ? <Loader2 size={14} className="animate-spin"/> : host.following ? <Check size={14}/> : <Plus size={14}/>}{copy(host.following ? 'Following' : 'Follow tournaments', host.following ? 'გამოწერილი' : 'ტურნირების გამოწერა')}</button>
            : <Link className="td-follow" to="/login">{copy('Sign in to follow', 'შესვლა გამოსაწერად')}</Link>}
        {error && <p role="alert" className="td-follow-error">{error}</p>}
    </article>;
}

function LoadState({ loading, error, onRetry }: { loading: boolean; error: string; onRetry: () => void }) {
    const copy = useCopy();
    if (loading) return <div className="tc-empty td-loading" role="status"><Loader2 className="animate-spin"/>{copy('Loading competitions…', 'შეჯიბრებები იტვირთება…')}</div>;
    return <div className="tw-error" role="alert"><p>{error}</p><button className="tw-button" onClick={onRetry}>{copy('Try again', 'ხელახლა ცდა')}</button></div>;
}

export function TournamentDiscovery({ onBrowse, onHosts, onHost, afterHighlights }: {
    onBrowse: (scope?: TournamentParticipantScope) => void; onHosts: () => void; onHost: (host: TournamentHost) => void; afterHighlights?: ReactNode;
}) {
    const copy = useCopy(), { isAuthenticated } = useAuth();
    const [result, setResult] = useState<TournamentDiscoveryOverview | null>(null), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
    const [settled, setSettled] = useState(-1), loading = settled !== attempt;
    useEffect(() => {
        let active = true;
        fetchTournamentDiscovery().then(data => { if (active) { setResult(data); setError(''); } })
            .catch(err => { if (active) setError(extractApiErrorMessage(err, copy('Could not load the tournament overview.', 'ტურნირების მიმოხილვა ვერ ჩაიტვირთა.'))); })
            .finally(() => { if (active) setSettled(attempt); });
        return () => { active = false; };
    // Language changes translate the rendered data without issuing another discovery request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [attempt]);
    const changeHost = (host: TournamentHost) => setResult(previous => {
        if (!previous) return previous;
        return { ...previous, suggestedHosts: previous.suggestedHosts.map(h => h.id === host.id && h.kind === host.kind ? host : h),
            followedHosts: host.following ? [...previous.followedHosts.filter(h => h.id !== host.id || h.kind !== host.kind), host]
                : previous.followedHosts.filter(h => h.id !== host.id || h.kind !== host.kind) };
    });
    if (loading || error || !result) return <LoadState loading={loading} error={error} onRetry={() => setAttempt(a => a + 1)}/>;
    const hostRows = result.followedHosts.length ? result.followedHosts : result.suggestedHosts;
    return <div className="td-overview">
        <section className="td-section" aria-labelledby="td-highlights"><div className="td-section-heading"><div><p className="td-kicker">{copy('TOURNAMENTS & LEAGUES', 'ტურნირები და ლიგები')}</p><h2 id="td-highlights">{copy('In the spotlight', 'ყურადღების ცენტრში')}</h2></div>
            <button className="tc-text-button" onClick={() => onBrowse()}>{copy('Browse all tournaments', 'ყველა ტურნირის ნახვა')}<ArrowRight size={15}/></button></div>
            {result.highlights.length ? <div className={`td-highlights td-highlights--${result.highlights.length}`}>
                {result.highlights.map(event => <CompetitionCard key={event.id} event={event} featured/>)}</div>
                : <div className="td-empty"><Trophy size={26}/><div><h3>{copy('The next competition is still taking shape', 'შემდეგი შეჯიბრება ჯერ მზადდება')}</h3><p>{copy('Browse published tournaments, hosts and previous results below.', 'ქვემოთ იხილეთ გამოქვეყნებული ტურნირები, მასპინძლები და შედეგები.')}</p></div><button className="tw-button" onClick={() => onBrowse()}>{copy('Browse tournaments', 'ტურნირების ნახვა')}<ArrowRight size={15}/></button></div>}
        </section>
        {afterHighlights}
        <Shelf title={copy(result.followedHosts.length ? 'Hosts you follow' : 'Find your tournament community', result.followedHosts.length ? 'გამოწერილი მასპინძლები' : 'იპოვეთ თქვენი სატურნირო საზოგადოება')}
            description={copy('Clubs and organizations to follow for their tournament activity.', 'გამოიწერეთ კლუბები და ორგანიზაციები მათი სატურნირო აქტივობისთვის.')}
            className="td-host-section" action={<button className="tc-text-button" onClick={onHosts}>{copy('Explore hosts', 'მასპინძლების ნახვა')}<ArrowRight size={15}/></button>}>
            {hostRows.map(host => <HostCard key={`${host.kind}:${host.id}`} host={host} onOpen={onHost} onChange={changeHost}/>)}
            {!hostRows.length && <div className="td-inline-empty"><Building2 size={22}/>{copy('Hosts appear here when they publish a public tournament.', 'მასპინძლები აქ გამოჩნდებიან საჯარო ტურნირის გამოქვეყნებისას.')}</div>}
        </Shelf>
        {!isAuthenticated && <p className="td-signin-note"><Link to="/login">{copy('Sign in', 'შესვლა')}</Link>{copy(' to build your own list of tournament hosts.', ' მასპინძლების პირადი სიის შესაქმნელად.')}</p>}
        {result.shelves.map(shelf => <Shelf key={shelf.scope} title={copy({ CLUB: 'Club competitions', SQUAD: 'Squad competitions', PLAYER: 'Player competitions' }[shelf.scope], { CLUB: 'კლუბების შეჯიბრებები', SQUAD: 'გუნდების შეჯიბრებები', PLAYER: 'მოთამაშეების შეჯიბრებები' }[shelf.scope])}
            description={copy({ CLUB: 'Represent your club on a bigger stage.', SQUAD: 'Find the right competition for your team.', PLAYER: 'Enter as a player and find your next challenge.' }[shelf.scope], { CLUB: 'წარმოადგინეთ თქვენი კლუბი ახალ ასპარეზზე.', SQUAD: 'იპოვეთ თქვენი გუნდისთვის შესაფერისი შეჯიბრება.', PLAYER: 'ჩაერთეთ როგორც მოთამაშე და იპოვეთ ახალი გამოწვევა.' }[shelf.scope])}
            action={<button className="tc-text-button" onClick={() => onBrowse(shelf.scope)}>{copy('View all', 'ყველას ნახვა')} <span className="td-total">{shelf.total}</span><ArrowRight size={15}/></button>}>
            {shelf.tournaments.map(event => <CompetitionCard key={event.id} event={event}/>)}
            {!shelf.tournaments.length && <div className="td-inline-empty"><Compass size={22}/>{copy('No published competitions in this category yet.', 'ამ კატეგორიაში ჯერ არ არის გამოქვეყნებული შეჯიბრება.')}</div>}
        </Shelf>)}
    </div>;
}

export function TournamentHosts({ kind, hostId, onHost, onBack }: { kind: TournamentHost['kind'] | null; hostId: number | null; onHost: (host: TournamentHost) => void; onBack: () => void }) {
    const copy = useCopy(), { isAuthenticated } = useAuth();
    const [page, setPage] = useState(0), [size, setSize] = useState(12), [query, setQuery] = useState(''), [search, setSearch] = useState(''), [following, setFollowing] = useState(false), [attempt, setAttempt] = useState(0);
    const [hosts, setHosts] = useState<PageResult<TournamentHost> | null>(null), [events, setEvents] = useState<PageResult<TournamentSummary> | null>(null), [error, setError] = useState(''), [settled, setSettled] = useState('');
    const [selectedHost, setSelectedHost] = useState<TournamentHost | null>(null);
    const key = JSON.stringify([kind, hostId, page, size, search, following, attempt]), loading = key !== settled;
    useEffect(() => { const timer = setTimeout(() => { setSearch(query.trim()); setPage(0); }, 250); return () => clearTimeout(timer); }, [query]);
    useEffect(() => {
        let active = true;
        const request = kind && hostId ? Promise.all([fetchHostTournaments({ kind, id: hostId, page, size }), fetchTournamentHost(kind, hostId)]).then(([data, host]) => { if (active) { setEvents(data); setSelectedHost(host); } })
            : fetchTournamentHosts({ page, size, search, following }).then(data => { if (active) setHosts(data); });
        request.then(() => { if (active) setError(''); }).catch(err => { if (active) setError(extractApiErrorMessage(err, copy('Could not load tournament hosts.', 'მასპინძლების ჩატვირთვა ვერ მოხერხდა.'))); }).finally(() => { if (active) setSettled(key); });
        return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);
    const result = kind && hostId ? events : hosts;
    return <section className="td-host-browser" aria-labelledby="td-host-browser-title">
        <div className="td-section-heading"><div>{kind && hostId && <button className="tc-text-button" onClick={onBack}><ArrowLeft size={15}/>{copy('All tournament hosts', 'ყველა მასპინძელი')}</button>}
            <h2 id="td-host-browser-title">{kind && hostId ? selectedHost?.name || copy('Competitions from this host', 'ამ მასპინძლის შეჯიბრებები') : copy('Tournament hosts', 'ტურნირების მასპინძლები')}</h2>
            <p>{copy('Public competitions, with tournament follows saved separately from general club follows.', 'საჯარო შეჯიბრებები; ტურნირების გამოწერა ინახება კლუბის საერთო გამოწერისგან დამოუკიდებლად.')}</p></div>
            {kind && hostId && <Link className="tw-button" to={`/${kind === 'CLUB' ? 'clubs' : 'organizations'}/${hostId}`}>{copy('View host profile', 'მასპინძლის პროფილი')}<ArrowRight size={15}/></Link>}</div>
        {!kind && <div className="td-host-toolbar"><label><Search size={16}/><span className="sr-only">{copy('Search hosts', 'მასპინძლების ძებნა')}</span><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={copy('Search clubs and organizations…', 'კლუბების და ორგანიზაციების ძებნა…')} maxLength={150}/></label>
            {isAuthenticated && <button className="tw-button" aria-pressed={following} onClick={() => { setFollowing(value => !value); setPage(0); }}>{following && <Check size={15}/>} {copy('Following only', 'მხოლოდ გამოწერილი')}</button>}</div>}
        {loading || error ? <LoadState loading={loading} error={error} onRetry={() => setAttempt(value => value + 1)}/> : <>
            {selectedHost && kind && <div className="td-selected-host"><HostCard host={selectedHost} onChange={setSelectedHost}/><div><h3>{copy('Public competitions', 'საჯარო შეჯიბრებები')}</h3><p>{copy('Follow this host to keep its tournament activity in your overview.', 'გამოიწერეთ ეს მასპინძელი მისი სატურნირო აქტივობის მიმოხილვაში სანახავად.')}</p></div></div>}
            <div className={kind ? 'td-host-events' : 'td-host-grid'}>{kind ? events?.content.map(event => <CompetitionCard key={event.id} event={event}/>)
                : hosts?.content.map(host => <HostCard key={`${host.kind}:${host.id}`} host={host} onOpen={onHost} onChange={updated => { setHosts(value => value && ({ ...value, content: value.content.map(h => h.id === updated.id && h.kind === updated.kind ? updated : h) })); if (following && !updated.following) { setPage(0); setAttempt(value => value + 1); } }}/>)}</div>
            {!result?.content.length && <div className="tc-empty"><Building2 size={28}/><h3>{copy(following ? 'No followed hosts yet' : 'No hosts found', following ? 'ჯერ არ გაქვთ გამოწერილი მასპინძლები' : 'მასპინძლები ვერ მოიძებნა')}</h3><p>{copy('Explore hosts and follow the competitions that interest you.', 'იპოვეთ მასპინძლები და გამოიწერეთ თქვენთვის საინტერესო შეჯიბრებები.')}</p></div>}
            {result && <PaginationBar page={page} totalPages={result.totalPages} totalElements={result.totalElements} pageSize={size} pageSizeOptions={[12,24]} onPageChange={setPage} onPageSizeChange={value => { setSize(value); setPage(0); }}/>}
        </>}
    </section>;
}
