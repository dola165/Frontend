import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Warehouse } from 'lucide-react';
import { MediaImage } from '../../../components/ui/MediaImage';
import { fetchVenue, formats, surfaces, type Venue } from '../../venues/api';
import { VenueCalendar } from '../../venues/VenueCalendar';
import { fromPrice, money } from '../../venues/utils';
import { setupChecks } from '../../venues/ownerWorkflow';
import '../../venues/venues.css';
import '../../venues/venue-owner.css';
import './organization-venues.css';

export function OrganizationVenues({ venues, view }: { venues: { id: number; name?: string }[]; view: 'venues' | 'schedule' | 'prices' }) {
  const ids = [...new Set(venues.map(v => v.id).filter(id => Number.isSafeInteger(id) && id > 0))].join(',');
  return <VenuePortfolio key={ids} ids={ids} view={view} />;
}

function VenuePortfolio({ ids, view }: { ids: string; view: 'venues' | 'schedule' | 'prices' }) {
  const { t } = useTranslation('translation', { keyPrefix: 'experience.venues' });
  const cache = useRef(new Map<number, Venue | null>());
  const [results, setResults] = useState<{ attempt: number; items: Map<number, Venue | null> } | null>(null);
  const [attempt, setAttempt] = useState(0), [selected, setSelected] = useState('');
  const items = results?.items;
  const pending = results?.attempt !== attempt;
  useEffect(() => {
    const controller = new AbortController();
    void Promise.all(ids.split(',').filter(Boolean).map(async value => {
      const id = Number(value);
      const previous = cache.current.get(id);
      if (previous) return [id, previous] as const;
      try { return [id, await fetchVenue(id, controller.signal)] as const; }
      catch { return [id, null] as const; }
    })).then(entries => {
      if (!controller.signal.aborted) {
        cache.current = new Map(entries);
        setResults({ attempt, items: cache.current });
      }
    });
    return () => controller.abort();
  }, [ids, attempt]);
  const visible = [...(items?.values() ?? [])].filter((v): v is Venue => !!v && !v.promotionBlocked);
  const bookable = visible.filter(canBook);
  const current = bookable.find(v => String(v.id) === selected) ?? bookable[0];
  const failed = items && [...items.values()].some(v => v === null);
  return <section className="entity-section organization-venues" aria-label={view === 'schedule' ? t('scheduleLabel') : view === 'prices' ? t('pricesLabel') : t('portfolioLabel')}>
    <h2>{view === 'schedule' ? t('schedule') : view === 'prices' ? t('pricesLabel') : t('title')}</h2>
    <p>{view === 'schedule' ? t('scheduleHint') : view === 'prices' ? t('pricesHint') : t('hint')}</p>
    {pending && <p role="status">{items ? t('retrying') : t('loading')}</p>}
    {failed && <div className="organization-venue-error" role="alert"><p>{t('failed')}</p><button type="button" className="venue-button" disabled={pending} onClick={() => setAttempt(n => n + 1)}>{t('retry')}</button></div>}
    {items && !visible.length && !failed && <p>{t('empty')}</p>}
    {view === 'venues' && <div className="venue-owner-portfolio">{visible.map(venue => {
      const price = fromPrice(venue), incomplete = setupChecks(venue).filter(c => !c.ready).length;
      const manages = venue.canManage && venue.capabilities?.canConfigureVenue;
      return <article key={venue.id} className="venue-owner-venue-card" aria-label={venue.displayName}>
        <div className="venue-owner-card-image">{venue.photos[0] ? <MediaImage src={venue.photos[0].url} alt="" /> : <Warehouse size={32} />}</div>
        <div><div className="venue-inline"><p className="venue-eyebrow">{venue.city || t('location')}</p>{venue.canManage && <span className="venue-tag">{venue.published ? t('published') : t('draft')}</span>}</div>
          <h3>{venue.displayName}</h3><div className="venue-owner-card-facts"><span>{t('pitches', { count: venue.pitches.filter(p => p.active).length })}</span>{canBook(venue) && <span>{venue.bookingMode === 'INSTANT' ? t('instant') : t('approval')}</span>}</div>
          {canBook(venue) && <p className="organization-venue-price">{price !== null ? t('fromPrice', { price: money(price, venue.currency) }) : t('noPrice')}</p>}
          {!venue.canManage && !canBook(venue) && <p>{t('bookingUnavailable')}</p>}
          {manages && incomplete > 0 && <Link className="venue-link" to={`/stadiums/${venue.id}/manage?view=setup`}>{t('setup', { count: incomplete })}</Link>}
          <div className="venue-owner-card-links">{venue.canManage ? <Link className="venue-button venue-button--primary" to={`/stadiums/${venue.id}/manage`}>{t('manage')}</Link> : canBook(venue) && <Link className="venue-button venue-button--primary" to={`/stadiums/${venue.id}?book=1`}>{t('availability')}</Link>}<Link className="venue-button" to={`/stadiums/${venue.id}`}>{t('view')}</Link></div>
          {venue.canManage && <div className="venue-owner-card-links"><Link className="venue-link" to={`/stadiums/${venue.id}/manage?view=calendar`}>{t('calendar')}</Link><Link className="venue-link" to={`/stadiums/${venue.id}/manage?view=requests`}>{t('requests')}</Link>{manages && <Link className="venue-link" to={`/stadiums/${venue.id}/manage?view=setup`}>{t('settings')}</Link>}</div>}
        </div>
      </article>;
    })}</div>}
    {view === 'schedule' && items && <>{current ? <><label className="organization-venue-picker">{t('picker')}<select value={current.id} onChange={e => setSelected(e.target.value)}>{bookable.map(v => <option key={v.id} value={v.id}>{v.displayName}{v.city ? ` · ${v.city}` : ''}</option>)}</select></label><VenueCalendar key={current.id} venue={current} /></> : visible.length > 0 && <p>{t('unavailable')}</p>}</>}
    {view === 'prices' && <div className="organization-price-list">{visible.map(v => <article className="entity-panel" key={v.id}><h3>{v.displayName}</h3>{!canBook(v) ? <p>{t('bookingUnavailable')}</p> : v.pitches.some(p => p.active) ? <ul>{v.pitches.filter(p => p.active).map(p => <li key={p.id}><span><strong>{p.name}</strong><small>{formats[p.format]} · {surfaces[p.surface]}{p.covered ? ` · ${t('covered')}` : ''}</small></span><span>{t('hourly', { price: money(p.pricePerHour, v.currency) })}</span></li>)}</ul> : <p>{t('noPitches')}</p>}<Link className="venue-link" to={`/stadiums/${v.id}${canBook(v) ? '?book=1' : ''}`}>{canBook(v) ? t('availability') : t('view')} →</Link></article>)}</div>}
  </section>;
}

const canBook = (venue: Venue) => venue.published && !venue.promotionBlocked
  && venue.capabilities?.enabledActivities.includes('VENUE') === true && venue.pitches.some(pitch => pitch.active);
