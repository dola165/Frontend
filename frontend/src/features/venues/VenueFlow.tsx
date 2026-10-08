import { MapPin, Warehouse } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { MediaImage } from '../../components/ui/MediaImage';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { formats, surfaces, type Pitch, type Venue, type VenueDraft } from './api';
import { money } from './utils';
import './venue-flow.css';

export function VenueSteps({ labels, step, onChange, disabled = false }: { labels: string[]; step: number; onChange: (step: number) => void; disabled?: boolean }) {
  const navigation = useRef<HTMLElement>(null), previous = useRef(step);
  useEffect(() => {
    if (previous.current === step) return;
    previous.current = step;
    navigation.current?.querySelector<HTMLElement>('[aria-current="step"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    navigation.current?.scrollIntoView?.({ block: 'start' });
  }, [step]);
  return <nav ref={navigation} className="venue-flow-steps" aria-label="Editor steps">{labels.map((label, i) => <button key={label} type="button" disabled={disabled} aria-current={i === step ? 'step' : undefined} onClick={() => onChange(i)}><span>{String(i + 1).padStart(2, '0')}</span><strong>{label}</strong></button>)}</nav>;
}

export function VenueListingPreview({ draft, venue }: { draft: VenueDraft; venue: Venue }) {
  const pitches = venue.pitches.filter(p => p.active);
  const price = pitches.length ? Math.min(...pitches.map(p => p.pricePerHour)) : null;
  return <aside className="venue-live-preview" tabIndex={0} aria-label="Stadium page preview">
    <div className="venue-preview-label"><span>Live page preview</span><small>Changes need saving</small></div>
    <div className="venue-preview-cover">{draft.photos[0] ? <MediaImage src={resolveMediaUrl(draft.photos[0].url)} alt={draft.photos[0].caption || 'Stadium cover preview'}/> : <div className="venue-preview-placeholder"><Warehouse size={36}/><span>Your cover photo goes here</span></div>}</div>
    <div className="venue-preview-body">{draft.logoUrl && <MediaImage src={resolveMediaUrl(draft.logoUrl)} alt="Stadium logo" className="h-16 w-16 rounded-xl object-contain"/>}
      <span className="venue-tag">{draft.published ? 'Public page' : 'Draft page'}</span>
      <h2>{draft.displayName || 'Your stadium name'}</h2>
      <p className="venue-preview-location"><MapPin size={15}/>{[draft.addressText, draft.city].filter(Boolean).join(', ') || 'Your address and city'}</p>
      <p className="venue-preview-description">{draft.description || 'Tell teams what makes this a good place to play.'}</p>
      <div className="venue-inline">{draft.amenities.filter(Boolean).map((a, i) => <span className="venue-tag" key={i}>{a}</span>)}</div>
      <strong className="venue-preview-price">{price == null ? 'Add a pitch to set your hourly rate' : `From ${money(price, draft.currency)} / hour`}</strong>
      <p>{draft.bookingMode === 'INSTANT' ? 'Instant confirmation' : 'Owner confirms requests'} · Pay at venue</p>
      <div className="venue-preview-hours">{draft.openingHours.length ? draft.openingHours.slice().sort((a,b) => a.dayOfWeek-b.dayOfWeek).map(h => <div key={h.dayOfWeek}><span>{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][h.dayOfWeek-1]}</span><strong>{h.opensAt.slice(0,5)}–{h.closesAt.slice(0,5)}</strong></div>) : <p>Add opening hours</p>}</div>
      <p className="venue-muted">{draft.publicPhone || 'Add your public contact number'}</p>
    </div>
  </aside>;
}

export function PitchPreview({ pitch, currency, sharedWith = [], saved = false, published = false }: { pitch: Omit<Pitch, 'id'>; currency: string; sharedWith?: string[]; saved?: boolean; published?: boolean }) {
  return <aside className="venue-live-preview" tabIndex={0} aria-label="Pitch preview">
    <div className="venue-preview-label"><span>Live pitch preview</span><small>{saved ? 'Saved pitch' : 'Changes need saving'}</small></div>
    {pitch.photoUrl
      ? <div className="venue-preview-cover"><MediaImage src={resolveMediaUrl(pitch.photoUrl)} alt={pitch.name ? `${pitch.name} photo` : 'Pitch photo preview'}/></div>
      : <div className="venue-preview-cover"><div className="venue-preview-placeholder"><Warehouse size={34}/><span>Add a photo of this pitch</span></div></div>}
    <div className="venue-preview-body"><span className="venue-tag">{!pitch.active ? 'Inactive' : !published ? 'Stadium draft' : saved ? 'Available to book' : 'Available after saving'}</span><h2>{pitch.name || 'Your pitch name'}</h2><p>{formats[pitch.format]} · {surfaces[pitch.surface]} · {pitch.covered ? 'Covered' : 'Open air'}</p><strong className="venue-preview-price">{money(pitch.pricePerHour, currency)} / hour</strong><p>{sharedWith.length ? `Shares availability with ${sharedWith.join(', ')}.` : 'An independent pitch with its own availability.'}</p></div>
  </aside>;
}
