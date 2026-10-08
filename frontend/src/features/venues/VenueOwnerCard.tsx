import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Warehouse } from 'lucide-react';
import { MediaImage } from '../../components/ui/MediaImage';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { fetchVenue, type Venue } from './api';
import { setupChecks } from './ownerWorkflow';

export function VenueOwnerCard({ id, label, settings }: { id: number; label: string; settings?: string }) {
  const [venue, setVenue] = useState<Venue | null>(null), [failed, setFailed] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetchVenue(id, controller.signal).then(data => { if (!controller.signal.aborted) { setVenue(data); setFailed(false); } }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [id, retry]);
  const checks = venue ? setupChecks(venue) : [], incomplete = checks.filter(c => !c.ready).length;
  return <article className="venue-owner-venue-card"><div className="venue-owner-card-image">{venue?.photos[0] && !venue.promotionBlocked ? <MediaImage src={resolveMediaUrl(venue.photos[0].url)} alt=""/> : <Warehouse size={32}/>}</div><div><div className="venue-inline"><p className="venue-eyebrow">{venue?.city || 'Stadium & pitches'}</p>{venue && <span className="venue-tag">{venue.promotionBlocked ? 'Promotion restricted' : !venue.capabilities?.enabledActivities.includes('VENUE') ? 'Intake paused' : venue.published ? 'Published' : 'Draft'}</span>}</div><h2>{venue?.displayName || label}</h2>{venue ? <><div className="venue-owner-card-facts"><span>{venue.pitches.filter(p => p.active).length} active pitches</span><span>{venue.bookingMode === 'INSTANT' ? 'Instant confirmation' : 'Owner approval'}</span></div>{incomplete > 0 && venue.capabilities?.canConfigureVenue && !venue.promotionBlocked && <Link className="venue-link" to={`/stadiums/${id}/manage?view=setup`}>{incomplete} setup details to check →</Link>}</> : <p role="status">{failed ? <>Venue details couldn’t load. <button className="venue-link" onClick={() => setRetry(r => r+1)}>Retry</button></> : 'Loading venue details…'}</p>}<div className="venue-owner-card-links"><Link className="venue-button venue-button--primary" to={`/stadiums/${id}/manage`}>Manage venue</Link>{!venue?.promotionBlocked && <Link className="venue-button" to={`/stadiums/${id}`}>View public page<ArrowUpRight size={16}/></Link>}</div><div className="venue-owner-card-links"><Link className="venue-link" to={`/stadiums/${id}/manage?view=calendar`}>Calendar</Link><Link className="venue-link" to={`/stadiums/${id}/manage?view=requests`}>Requests</Link>{settings && <Link className="venue-link" to={settings}>Organization settings</Link>}</div></div></article>;
}
