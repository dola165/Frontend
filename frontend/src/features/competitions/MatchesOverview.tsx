import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trophy, ArrowRight, CalendarDays, Clock3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { fetchTournamentDiscovery } from '../tournaments/api';
import type { TournamentDiscoveryOverview, TournamentHost, TournamentSummary } from '../tournaments/domain';
import { HostCard } from '../tournaments/components/TournamentDiscovery';
import { TournamentStatusBadge } from '../../components/tournaments/TournamentPresentation';
import { formatTournamentDateRange } from '../../components/tournaments/tournamentFormatters';
import { getCompetitionProfile, structureLabels, type Profile } from './api';
import { useCompetitionCopy } from './competitionCopy';
import { MatchActivity } from './MatchActivity';
import CompetitionDirectory from './CompetitionDirectory';
import { CompetitionVisual } from './CompetitionVisual';

function FeaturedCompetition({ event }: { event: TournamentSummary }) {
  const { i18n } = useTranslation(), translate = useCompetitionCopy();
  const copy = (en: string, ka: string) => i18n.language.startsWith('ka') ? ka : en;
  const [profile, setProfile] = useState<Profile | null>(null);
  useEffect(() => { const abort = new AbortController();void getCompetitionProfile(event.id, abort.signal).then(value => { if (!abort.signal.aborted) setProfile(value); }).catch(() => { /* The public summary remains usable without optional format metadata. */ });return () => abort.abort(); }, [event.id]);
  const rules = profile?.rules, deadline = event.registrationClosesAt ? new Date(event.registrationClosesAt) : null;
  return <Link className="mc-featured-event" to={`/tournaments/${event.id}`}>
    <div className="mc-featured-heading"><span className="mc-featured-photo"><CompetitionVisual id={event.id} name={event.name} imageUrl={event.bannerImageUrl} discipline={rules?.discipline}/></span><div><TournamentStatusBadge status={event.status}/><h3>{event.name}</h3></div></div>
    {rules && <p className="mc-featured-format">{translate(rules.ageGroup)} · {rules.sideSize}v{rules.sideSize} · {translate(structureLabels[rules.structure])}</p>}
    <p className="mc-featured-meta"><CalendarDays size={14} aria-hidden="true"/>{formatTournamentDateRange(event.startDate, event.endDate, i18n.language) || copy('Dates to be confirmed', 'თარიღები დასაზუსტებელია')}</p>
    {deadline && !Number.isNaN(deadline.getTime()) && <p className="mc-featured-meta"><Clock3 size={14} aria-hidden="true"/>{copy('Entry deadline', 'მონაწილეობის ვადა')}: {deadline.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
    <span className="mc-featured-host">{event.hostClubName || event.organizerName}<span>{copy('Explore tournament', 'ტურნირის ნახვა')}<ArrowRight size={14} aria-hidden="true"/></span></span>
  </Link>;
}

export function MatchesOverview() {
  const { i18n } = useTranslation(), navigate = useNavigate();
  const copy = (en: string, ka: string) => i18n.language.startsWith('ka') ? ka : en;
  const [data, setData] = useState<TournamentDiscoveryOverview | null>(null), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => { let current = true;void fetchTournamentDiscovery().then(value => { if (current) { setData(value);setFailed(false); } }).catch(() => { if (current) setFailed(true); });return () => { current = false; }; }, [attempt]);
  const updateHost = (host: TournamentHost) => setData(previous => previous && ({ ...previous, suggestedHosts: previous.suggestedHosts.map(h => h.kind === host.kind && h.id === host.id ? host : h), followedHosts: host.following ? [...previous.followedHosts.filter(h => h.kind !== host.kind || h.id !== host.id), host] : previous.followedHosts.filter(h => h.kind !== host.kind || h.id !== host.id) }));
  const hosts = data ? [...data.followedHosts, ...data.suggestedHosts.filter(h => !data.followedHosts.some(f => f.id === h.id && f.kind === h.kind))].slice(0, 6) : [];
  return <div className="mc-overview-content">
    <div className="mc-overview-lanes"><MatchActivity/><section className="mc-lane mc-lane-tournament" aria-labelledby="mc-tournament-lane-title">
      <div className="mc-lane-top"><span className="mc-lane-label"><Trophy size={14} aria-hidden="true"/>{copy('Tournaments & leagues', 'ტურნირები და ლიგები')}</span><Link to="/matches?section=competitions">{copy('Browse all', 'ყველას ნახვა')}<ArrowRight size={15} aria-hidden="true"/></Link></div>
      <h2 id="mc-tournament-lane-title">{copy('A competition worth playing for', 'იპოვეთ თქვენი შემდეგი შეჯიბრება')}</h2><p className="mc-lane-description">{copy('A season, a cup run or a day of football. Find your next challenge.', 'სეზონი, თასი თუ ფეხბურთის დღე — აირჩიეთ შემდეგი გამოწვევა.')}</p>
      <div className="mc-lane-main">{failed ? <div className="mc-lane-empty" role="alert"><p>{copy('Tournament highlights could not load.', 'რჩეული ტურნირები ვერ ჩაიტვირთა.')}</p><button type="button" onClick={() => { setFailed(false);setAttempt(n => n + 1); }}>{copy('Try again', 'ხელახლა ცდა')}</button></div> : !data ? <p className="mc-lane-empty" role="status">{copy('Loading tournament highlights…', 'რჩეული ტურნირები იტვირთება…')}</p> : data.highlights[0] ? <FeaturedCompetition key={data.highlights[0].id} event={data.highlights[0]}/> : <div className="mc-lane-empty"><Trophy size={24} aria-hidden="true"/><p>{copy('Discover published events and find a format that suits your team.', 'იპოვეთ გამოქვეყნებული ღონისძიებები და თქვენი გუნდის ფორმატი.')}</p><Link to="/matches?section=competitions">{copy('Explore competitions', 'შეჯიბრებების ნახვა')}<ArrowRight size={15}/></Link></div>}</div>
      <footer className="mc-lane-footer"><Link to="/matches?section=competitions&registration=OPEN">{copy('Open for registration', 'რეგისტრაცია ღიაა')}<ArrowRight size={14} aria-hidden="true"/></Link><Link to="/matches?section=competitions&view=hosts">{copy('Discover hosts', 'მასპინძლების ნახვა')}</Link></footer>
    </section></div>
    <CompetitionDirectory overview/>
    {hosts.length > 0 && <section className="mc-host-strip" aria-labelledby="mc-host-strip-title"><div className="mc-section-heading"><div><h2 id="mc-host-strip-title">{copy('Follow the hosts behind the football', 'გამოიწერეთ ფეხბურთის მასპინძლები')}</h2><p>{copy('Open a host to see its tournaments, dates and registration details.', 'გახსენით მასპინძელი ტურნირების, თარიღებისა და რეგისტრაციის სანახავად.')}</p></div><Link to="/matches?section=competitions&view=hosts">{copy('All hosts', 'ყველა მასპინძელი')}<ArrowRight size={15}/></Link></div><div className="mc-host-tiles">{hosts.map(host => <HostCard key={`${host.kind}:${host.id}`} host={host} onChange={updateHost} onOpen={h => navigate(`/matches?section=competitions&view=hosts&kind=${h.kind}&host=${h.id}`)}/>)}</div></section>}
  </div>;
}
