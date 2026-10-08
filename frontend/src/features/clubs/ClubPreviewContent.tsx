import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/axiosConfig';
import { useAuth } from '../../context/AuthContext';
import type { ClubProfile } from '../../pages/ClubProfilePage';
import { TabTraining } from '../../components/club/tabs/TabTraining';
import { TabFacilities } from '../../components/club/tabs/TabFacilities';
import { TabPeople } from '../../components/club/tabs/TabPeople';
import { TabCalendar } from '../../components/club/tabs/TabCalendar';
import { TabEvents } from '../../components/club/tabs/TabEvents';
import { TabContact } from '../../components/club/tabs/TabContact';
import { TabHonours } from '../../components/club/tabs/TabHonours';
import { TabMedia } from '../../components/club/tabs/TabMedia';
import { ClubBusinessTab } from '../../components/club/ClubBusinessTab';
import { ClubAffiliations } from '../../components/club/ClubPresentation';
import { ClubEnquiryModal } from '../../components/club/ClubEnquiryModal';
import { RoleProfileSummary } from '../roles/RoleProfileSummary';
import { roleLabel, type FootballProfile, type RoleProfile } from '../roles/domain';
import { CampaignProgress } from '../campaigns/CampaignProgress';
import { type Campaign, campaignDate, campaignPhase } from '../campaigns/api';
import { type StoreProduct, formatStorePrice } from '../store/api';
import { type ClubJob } from './api';
import { applicationMethodLabel, labelForCategory, labelForEngagement } from './jobLabels';
import type { Venue } from '../venues/api';
import { formats, surfaces } from '../venues/api';
import type { Match } from '../matchExchange/api';
import type { MatchHistoryPage } from '../matchHistory/api';
import type { ScheduleEventOccurrence } from '../schedule/api';
import { ScheduleScore } from '../matchHistory/ScheduleResult';
import type { FeedPostDto, CommentDto } from '../../components/feed/FeedPost';
import { MediaImage } from '../../components/ui/MediaImage';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { ClubPreviewActiveContext, useClubProfileSearchParams } from './clubProfilePreviewContext';
import type { ClubPreviewTarget } from './clubProfilePreviewRoutes';
import type { ClubEnquiryContext } from './publicJourney';

/** Uses existing access-controlled endpoints. No parallel private-data cache or new publication rules. */
function Resource<T>({ path, children }: { path: string; children: (data: T) => ReactNode }) {
  const [result, setResult] = useState<{ key: string; data?: T; error?: string } | null>(null);
  const [retry, setRetry] = useState(0);
  const key = `${path}:${retry}`;
  useEffect(() => {
    const controller = new AbortController();
    void apiClient.get<T>(path, { signal: controller.signal }).then(response => {
      if (!controller.signal.aborted) setResult({ key, data: response.data });
    }).catch(error => {
      if (controller.signal.aborted) return;
      const status = error?.response?.status;
      setResult({ key, error: status === 401 || status === 403 ? 'These details are restricted. Open the full page to sign in or check your access.' : status === 404 ? 'These details are no longer available.' : 'Details could not load. Your club page is still in place.' });
    });
    return () => controller.abort();
  }, [path, key]);
  if (result?.key !== key) return <p role="status">Loading details…</p>;
  if (result.error) return <div role="alert" className="cp-empty"><p>{result.error}</p><button className="cp-button" onClick={() => setRetry(value => value + 1)}>Retry details</button></div>;
  return <>{children(result.data!)}</>;
}

export function ClubPreviewContent({ target, club }: { target: ClubPreviewTarget; club: ClubProfile }) {
  const [params] = useClubProfileSearchParams();
  switch (target.kind) {
    case 'club': return target.id === club.id ? <ClubSection club={club} target={target}/> : <Resource<ClubProfile> path={`/clubs/${target.id}`}>{data => <ClubSection club={data} target={target}/>}</Resource>;
    case 'person': return <Resource<Person> path={`/users/${target.id}`}>{person => <PersonDetails person={person}/>}</Resource>;
    case 'venue': return <Resource<Venue> path={`/venues/${target.id}`}>{venue => <VenueDetails venue={venue}/>}</Resource>;
    case 'product': return <Resource<StoreProduct> path={`/store/products/${target.id}`}>{product => <div className="club-preview-detail"><h2>{product.name}</h2><Photos urls={product.images ?? []}/><strong>{product.price == null ? 'Price not published' : formatStorePrice(product.price, product.currency)}</strong><p className="club-preview-copy">{product.description}</p><dl>{product.variants?.map(variant => <div key={variant.id ?? variant.label}><dt>{variant.label}</dt><dd>{variant.stock > 0 ? 'In stock' : 'Out of stock'}</dd></div>)}</dl><p className="cp-muted">Open the product page to choose a variant and prepare your cart. Online checkout is not available yet.</p></div>}</Resource>;
    case 'campaign': return <Resource<Campaign> path={`/campaigns/${target.id}`}>{campaign => <div className="club-preview-detail campaigns-page"><h2>{campaign.title}</h2><p>{campaign.summary}</p><Photos urls={campaign.images ?? []}/><p>{campaignPhase(campaign.phase)}</p><CampaignProgress campaign={campaign}/><p className="cp-muted">Reported funds are supplied by the club and are unverified by GrassKickZ.</p><p className="club-preview-copy">{campaign.description}</p>{campaign.beneficiary && <section><h3>Who benefits</h3><p>{campaign.beneficiary}</p></section>}{campaign.useOfFunds && <section><h3>Use of funds</h3><p>{campaign.useOfFunds}</p></section>}{campaign.endsOn && <p>Ends {campaignDate(campaign.endsOn)}</p>}{campaign.updates?.map(update => <article className="cp-card" key={update.id}><h3>{update.title}</h3><p className="club-preview-copy">{update.body}</p></article>)}</div>}</Resource>;
    case 'job': return <Resource<ClubJob> path={`/jobs/${target.id}`}>{job => <div className="club-preview-detail"><p className="cp-eyebrow">{job.clubName} · {job.status}</p><h2>{job.title}</h2><dl><Fact label="Area" value={labelForCategory(job.category)}/><Fact label="Engagement" value={labelForEngagement(job.engagementType)}/><Fact label="Eligibility" value={job.ageGroup}/><Fact label="Level" value={job.level}/><Fact label="Application" value={applicationMethodLabel(job)}/></dl><p className="club-preview-copy">{job.description}</p>{job.clubId && <Link className="cp-back" to={`/clubs/${job.clubId}?tab=contact&roleId=${job.id}&roleTitle=${encodeURIComponent(job.title)}`}>Ask the club about this role →</Link>}</div>}</Resource>;
    case 'post': return <Resource<FeedPostDto> path={`/posts/${target.id}`}>{post => <div className="club-preview-detail"><h2>{post.clubName || post.authorName}</h2><p className="cp-muted">{date(post.createdAt)}</p><Photos urls={post.mediaUrls?.length ? post.mediaUrls : post.image ? [post.image] : []} initial={Number(params.get('media') ?? 0)}/><p className="club-preview-copy">{post.content}</p><p>{post.reactionCount ?? post.likeCount} reactions · {post.commentCount} comments</p>{post.commentCount > 0 && <details><summary>Read comments</summary><Resource<CommentDto[]> path={`/posts/${post.id}/comments`}>{comments => <div className="cp-stack">{comments.map(comment => <article key={comment.id} className="cp-card"><strong>{comment.authorName}</strong><p className="club-preview-copy">{comment.content}</p></article>)}</div>}</Resource></details>}</div>}</Resource>;
    case 'match': return <Resource<Match> path={`/match-exchange/${target.id}`}>{match => <div className="club-preview-detail"><h2>{match.title}</h2><p>{match.club_name} {match.opponent_name ? `vs ${match.opponent_name}` : ''}</p><p>{date(match.starts_at_iso || match.starts_at)} · {match.timezone}</p><p>{match.location_name}</p><dl><Fact label="Squad" value={match.squad_name}/><Fact label="Age group" value={match.age_group}/><Fact label="Format" value={formats[match.format as keyof typeof formats] || match.format}/><Fact label="Status" value={match.event_status}/><Fact label="Result" value={match.home_score != null && match.away_score != null ? `${match.home_score} – ${match.away_score} · ${match.result_status || 'Recorded'}` : 'Result not recorded'}/></dl><p className="club-preview-copy">{match.description}</p>{match.venue_id && <Link className="cp-back" to={`/stadiums/${match.venue_id}`}>Venue details →</Link>}</div>}</Resource>;
    case 'event': return <Resource<ScheduleEventOccurrence> path={`/schedule/events/${target.id}`}>{event => <div className="club-preview-detail"><h2>{event.title}</h2><p>{date(event.startsAt)} – {date(event.endsAt)}</p><p>{event.locationName}</p><ScheduleScore event={event}/><p>{event.status}</p><p className="club-preview-copy">{event.description}</p></div>}</Resource>;
    case 'history': return <Resource<MatchHistoryPage> path={`/match-history?${params}`}>{history => <div className="club-preview-detail"><h2>Results & history</h2>{history.items.length ? history.items.map(match => <Link className="cp-card" key={match.id} to={match.detailPath}><h3>{match.title}</h3><p>{match.startsAt ? date(match.startsAt) : 'Date not recorded'}</p><strong>{match.homeScore != null && match.awayScore != null ? `${match.homeScore} – ${match.awayScore}` : 'No result recorded'}</strong><p>{match.resultStatus}</p></Link>) : <p>No results match these filters.</p>}{history.total > history.items.length && <p className="cp-muted">Showing {history.items.length} of {history.total}. Open match history for more filters and pages.</p>}</div>}</Resource>;
  }
}

function ClubSection({ club, target }: { club: ClubProfile; target: ClubPreviewTarget }) {
  const [params] = useClubProfileSearchParams(), { status } = useAuth();
  const [enquiry, setEnquiry] = useState<ClubEnquiryContext | null>(null);
  const tab = /\/store(?:\?|$)/.test(target.path) ? 'store' : /\/campaigns(?:\?|$)/.test(target.path) ? 'campaigns' : params.get('tab') || 'overview';
  let content: ReactNode;
  switch (tab) {
    case 'teams': content = <TabTraining club={club} isAuthenticated={status === 'authenticated'} onContact={setEnquiry}/>; break;
    case 'facilities': content = <TabFacilities club={club} isOwnClubAdmin={false}/>; break;
    case 'people': content = <TabPeople clubId={club.id} clubName={club.name} isOwnClubAdmin={false}/>; break;
    case 'schedule': content = <TabCalendar clubId={club.id} isOwnClubAdmin={false}/>; break;
    case 'events': content = <TabEvents clubId={club.id} isOwnClubAdmin={false}/>; break;
    case 'contact': content = <TabContact club={club}/>; break;
    case 'honours': content = <TabHonours club={club}/>; break;
    case 'media': content = <div className="cp-stack"><TabMedia clubId={club.id} mediaType="pictures"/><TabMedia clubId={club.id} mediaType="videos"/></div>; break;
    case 'business': content = <ClubBusinessTab club={club} ownClubRole={club.myRole ?? null} isAuthenticated={status === 'authenticated'}/>; break;
    case 'store': content = <Resource<{ content: StoreProduct[]; totalElements: number }> path={`/store/products?clubId=${club.id}&size=20&page=0`} >{result => <div className="club-preview-detail"><h2>{club.name} store</h2>{result.content.map(product => <Link className="cp-card" key={product.id} to={`/store/products/${product.id}`}><h3>{product.name}</h3><p>{product.price == null ? 'Price not published' : formatStorePrice(product.price, product.currency)}</p></Link>)}<p>{result.totalElements ? `Showing ${result.content.length} of ${result.totalElements} products. Open the club store for the full catalogue.` : 'No products have been published.'}</p></div>}</Resource>; break;
    case 'campaigns': content = <Resource<{ content: Campaign[]; totalElements: number }> path={`/campaigns?clubId=${club.id}&state=ALL&size=20&page=0`}>{result => <div className="club-preview-detail"><h2>{club.name} campaigns</h2>{result.content.map(campaign => <Link className="cp-card" key={campaign.id} to={`/campaigns/${campaign.id}`}><h3>{campaign.title}</h3><p>{campaign.summary}</p></Link>)}<p>{result.totalElements ? `Showing ${result.content.length} of ${result.totalElements} campaigns.` : 'No campaigns have been published.'}</p></div>}</Resource>; break;
    default: content = <div className="club-preview-detail"><div className="club-preview-identity">{club.logoUrl && <MediaImage src={resolveMediaUrl(club.logoUrl)} alt=""/>}<h2>{club.name}</h2></div><p>{club.addressText}</p><p className="club-preview-copy">{club.description}</p><div className="cp-journey-links">{[['teams', 'Training & teams'], ['facilities', 'Venues & facilities'], ['people', 'Coaches & staff'], ['schedule', 'Schedule'], ['events', 'Events'], ['contact', 'Contact']].map(([id, name]) => <Link key={id} to={`/clubs/${club.id}?tab=${id}`}>{name} →</Link>)}</div>{club.presentation && <ClubAffiliations presentation={club.presentation}/>}</div>;
  }
  return <>{content}{enquiry && <ClubEnquiryModal clubId={club.id} clubName={club.name} context={enquiry} onClose={() => setEnquiry(null)}/>}</>;
}

interface Person { id: number; fullName?: string; username: string; role: string; bio?: string; avatarUrl?: string; isPrivate?: boolean; roleProfiles?: RoleProfile[]; footballProfile?: FootballProfile }
function PersonDetails({ person }: { person: Person }) {
  return <div className="club-preview-detail"><div className="club-preview-identity">{person.avatarUrl && <MediaImage src={resolveMediaUrl(person.avatarUrl)} alt=""/>}<div><h2>{person.fullName || person.username}</h2><p>{roleLabel(person.role)}</p></div></div>{person.isPrivate ? <p>This profile is private.</p> : <><p className="club-preview-copy">{person.bio}</p><RoleProfileSummary profiles={(person.roleProfiles ?? []).filter(role => role.published)}/>{person.footballProfile?.appointments?.map(appointment => <article key={appointment.clubId} className="cp-card"><h3>{appointment.title}</h3><Link to={`/clubs/${appointment.clubId}`}>{appointment.clubName}</Link><p>{appointment.squads.join(' · ')}</p>{appointment.biography && <p className="club-preview-copy">{appointment.biography}</p>}{appointment.qualifications && <p>Qualifications · self-reported: {appointment.qualifications}</p>}</article>)}{person.footballProfile?.entries?.filter(entry => entry.published).map(entry => <article key={entry.id} className="cp-card"><h3>{entry.title}</h3><p>{entry.organization}</p><p className="cp-muted">{entry.startsOn}{entry.endsOn ? ` – ${entry.endsOn}` : ''} · Self-reported</p><p className="club-preview-copy">{entry.description}</p></article>)}</>}</div>;
}

function VenueDetails({ venue }: { venue: Venue }) {
  if (venue.promotionBlocked) return <p>This venue is unavailable for promotion.</p>;
  return <div className="club-preview-detail"><h2>{venue.displayName}</h2><p>{venue.addressText}</p><Photos urls={venue.photos?.map(photo => photo.url) ?? []}/><p className="club-preview-copy">{venue.description}</p>{venue.amenities?.length > 0 && <section><h3>At the venue</h3><p>{venue.amenities.map(value => value.replaceAll('_', ' ').toLowerCase()).join(' · ')}</p></section>}{venue.pitches?.filter(pitch => pitch.active).map(pitch => <article className="cp-card" key={pitch.id}><h3>{pitch.name}</h3><p>{formats[pitch.format]} · {surfaces[pitch.surface]}{pitch.covered ? ' · Covered' : ''}</p></article>)}{venue.openingHours?.length > 0 && <section><h3>Opening hours · {venue.timezone}</h3><dl>{venue.openingHours.map(day => <Fact key={`${day.dayOfWeek}-${day.opensAt}`} label={['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][day.dayOfWeek] || String(day.dayOfWeek)} value={`${day.opensAt}–${day.closesAt}`}/>)}</dl></section>}</div>;
}

function Photos({ urls, initial = 0 }: { urls: string[]; initial?: number }) {
  const active = useContext(ClubPreviewActiveContext), video = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (!active) video.current?.pause(); }, [active]);
  const [index, setIndex] = useState(() => Number.isInteger(initial) ? Math.max(0, Math.min(initial, urls.length - 1)) : 0);
  const source = resolveMediaUrl(urls[index]);
  if (!source) return null;
  return <div className="club-preview-photos">{/\.(mp4|mov|webm)(?:\?|$)/i.test(source) ? <video ref={video} key={source} src={source} controls playsInline preload="metadata"/> : <MediaImage src={source} alt={`Photo ${index + 1}`}/>} {urls.length > 1 && <nav aria-label="Preview photos"><button className="cp-button" disabled={index === 0} onClick={() => setIndex(value => value - 1)}>Previous photo</button><span>{index + 1} / {urls.length}</span><button className="cp-button" disabled={index === urls.length - 1} onClick={() => setIndex(value => value + 1)}>Next photo</button></nav>}</div>;
}
const date = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const Fact = ({ label, value }: { label: string; value?: string | null }) => value ? <div><dt>{label}</dt><dd>{value}</dd></div> : null;
