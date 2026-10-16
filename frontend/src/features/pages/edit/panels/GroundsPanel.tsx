import { lazy, Suspense, useEffect, useId, useState } from 'react';
import { MapPin, Plus, Trash2 } from 'lucide-react';
import type { MapBounds } from '../../../../components/map/areaSearch';
import { Button, List, ListRow, Skeleton } from '../../../../design/primitives';
import { fetchPitches, reverseGeocode, type Ground, type Pitch } from '../../api';
import { usePagesCopy } from '../../copy';
import { setPetHint, usePetAnswer } from '../../guide/bridge';
import { usePageEdit } from '../context';
import { SplitPanel } from '../SplitPanel';

const GroundsMap = lazy(() => import('./GroundsMap'));
const SURFACE: Record<Pitch['surface'], string> = { GRASS: 'Grass', ARTIFICIAL: 'Artificial turf', HYBRID: 'Hybrid grass', INDOOR: 'Indoor' };
const inside = (pitch: Pitch, bounds: MapBounds | null) => !bounds || (pitch.latitude >= bounds.south && pitch.latitude <= bounds.north && pitch.longitude >= bounds.west && pitch.longitude <= bounds.east);
const fromPitch = (pitch: Pitch): Ground => ({ id: -Date.now(), name: pitch.name, address: pitch.address, town: pitch.town, latitude: pitch.latitude, longitude: pitch.longitude, surface: pitch.surface, size: pitch.size, indoor: pitch.indoor, pitchId: pitch.id, venueId: pitch.venueId });

/**
 * Where you play: a wide map across the top, centred on the town with the pitches nearby as pins, and under it the
 * list that follows the map (a tap adds a pitch, the address comes from it) beside another place and the chosen
 * grounds, so it all fits without scrolling. A place that is not listed is named first and then put on the map with a
 * tap (Dola runs to the map and asks where it is); a tap on empty ground first drops a pin to name. A ground's name
 * typed to Dola is added the same way.
 */
export function GroundsPanel() {
  const t = usePagesCopy();
  const { page, saveBox, closePanel } = usePageEdit();
  const [chosen, setChosen] = useState<Ground[]>(page?.boxes.grounds.items ?? []);
  const [pitches, setPitches] = useState<Pitch[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [dropped, setDropped] = useState<{ lat: number; lng: number; address: string | null } | null>(null);
  const [other, setOther] = useState({ name: '', address: '' });
  // A named place still waiting for its spot on the map, and the last one put there.
  const [placing, setPlacing] = useState<Ground | null>(null);
  const [placed, setPlaced] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = useId();
  const town = page?.identity.town;
  useEffect(() => {
    if (!town || town.latitude == null || town.longitude == null) return;
    const controller = new AbortController();
    fetchPitches(town.latitude, town.longitude, 25, controller.signal).then(found => { if (!controller.signal.aborted) setPitches(found); }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [town]);
  // Dola follows along: to the map while a place waits for its spot, then she says it is there.
  useEffect(() => {
    setPetHint('grounds', placing ? { selector: '.gk-grounds-map', line: t('Where is {name}? Tap its spot on the map.', { name: placing.name }) }
      : placed ? { said: t('Understood. {name} is on the map.', { name: placed }) } : null);
  }, [placed, placing, t]);
  useEffect(() => () => setPetHint('grounds', null), []);
  const named = (name: string): Ground | null => (town && town.latitude != null && town.longitude != null
    ? { id: -Date.now(), name, address: `${town.name}, Georgia`, town: town.name, latitude: town.latitude, longitude: town.longitude, surface: 'ARTIFICIAL', size: '7v7', indoor: false, pitchId: null, venueId: null } : null);
  // Typed to Dola: a listed pitch by its name, else another place with that name, to be put on the map next.
  usePetAnswer('grounds', text => {
    const words = text.trim(), wanted = words.toLowerCase();
    if (words.length < 2) return null;
    const pitch = (pitches ?? []).find(item => item.name.toLowerCase().includes(wanted) || wanted.includes(item.name.toLowerCase()));
    const ground = pitch ? fromPitch(pitch) : named(words);
    if (!ground) return null;
    setChosen(current => (current.some(item => (pitch ? item.pitchId === pitch.id : item.name === words)) ? current : [...current, ground]));
    if (!pitch) { setPlacing(ground); setPlaced(null); }
    return t(pitch ? '{name} is on your list. Tap Done to keep it.' : '{name} is on your list.', { name: ground.name });
  });
  if (!page || !town || town.latitude == null || town.longitude == null) return null;
  const centre = { lat: town.latitude, lng: town.longitude };
  const add = (pitch: Pitch) => setChosen(current => (current.some(ground => ground.pitchId === pitch.id) ? current : [...current, fromPitch(pitch)]));
  const drop = (lat: number, lng: number) => {
    if (placing) {
      // The named place goes where the owner tapped; its address is looked up from the spot.
      const target = placing.id;
      setChosen(current => current.map(ground => (ground.id === target ? { ...ground, latitude: lat, longitude: lng } : ground)));
      reverseGeocode(lat, lng).then(place => { if (place.address) setChosen(current => current.map(ground => (ground.id === target ? { ...ground, address: place.address ?? ground.address } : ground))); }).catch(() => undefined);
      setPlaced(placing.name); setPlacing(null);
      return;
    }
    setDropped({ lat, lng, address: null });
    reverseGeocode(lat, lng).then(place => { setDropped(current => (current && current.lat === lat ? { ...current, address: place.address } : current)); if (place.address) setOther(current => ({ ...current, address: place.address ?? '' })); }).catch(() => undefined);
  };
  const addOther = () => {
    const base = named(other.name.trim());
    if (!other.name.trim() || !base) return;
    const ground = { ...base, address: other.address.trim() || `${town.name}, Georgia`, ...(dropped ? { latitude: dropped.lat, longitude: dropped.lng } : {}) };
    setChosen(current => [...current, ground]);
    // Without a pin yet, the map asks for its spot next.
    if (!dropped) { setPlacing(ground); setPlaced(null); }
    setOther({ name: '', address: '' }); setDropped(null);
  };
  const save = async () => {
    setBusy(true);
    try { await saveBox('grounds', { items: chosen.map(ground => ({ ...ground, id: ground.id < 0 ? undefined : ground.id })) }, { label: t('Grounds saved') }); closePanel(); } finally { setBusy(false); }
  };
  const chosenIds = new Set(chosen.map(ground => ground.pitchId).filter((value): value is string => Boolean(value)));
  const places = chosen.filter(ground => !ground.pitchId && ground.id !== placing?.id).map(ground => ({ lat: ground.latitude, lng: ground.longitude, name: ground.name }));
  // Nearest first; once the owner moves the map, the list follows what is in view.
  const listed = [...(pitches ?? [])].sort((a, b) => a.distanceKm - b.distanceKm).filter(pitch => !chosenIds.has(pitch.id) && inside(pitch, bounds)).slice(0, bounds ? 6 : 5);
  return (
    <SplitPanel wide title={t('Where do you play?')} description={t('Tap a pitch on the map, or tap the ground where you play.')} onClose={closePanel}
      footer={<><Button variant="ghost" onClick={closePanel}>{t('Cancel')}</Button><Button variant="primary" disabled={busy} onClick={() => void save()}>{t('Done')}</Button></>}>
      <div className="gk-grounds" data-placing={placing ? true : undefined}>
        {/* The map waits for the pitches, so it can open with the nearest ones in view. */}
        {pitches === null && !failed ? <Skeleton height={260} /> : <Suspense fallback={<Skeleton height={260} />}><GroundsMap center={centre} pitches={pitches ?? []} chosen={chosenIds} dropped={dropped} places={places} onPick={add} onDrop={drop} onBounds={setBounds} /></Suspense>}
        <div className="gk-grounds__cols">
          <div>
            {failed ? <p className="gk-notice gk-notice--warning" role="alert">{t('Pitches near you could not load. Add a place by name below.')}</p>
              : pitches === null ? <><Skeleton height={44} /><Skeleton height={44} /></>
              : listed.length === 0 ? <p className="gk-muted">{t('No listed pitches on this part of the map.')}</p>
              : <List label={t('Pitches nearby')}>{listed.map(pitch => <ListRow key={pitch.id} onClick={() => add(pitch)} lead={<span className="gk-club-icon"><MapPin aria-hidden="true" /></span>} title={pitch.name} meta={`${pitch.distanceKm} km · ${t(SURFACE[pitch.surface])} · ${pitch.size}`} trail={<Plus aria-hidden="true" className="gk-faint" size={16} />} />)}</List>}
          </div>
          <div className="gk-boxedit">
            <div>
              <label className="gk-field__label" htmlFor={`${id}-other`}>{dropped ? t('The place you tapped') : t('Another place')}</label>
              <div className="gk-boxedit__row">
                <input id={`${id}-other`} className="gk-input" value={other.name} placeholder={t('Its name')} maxLength={120} onChange={event => setOther({ ...other, name: event.target.value })} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addOther(); } }} />
                <input className="gk-input" value={other.address} placeholder={dropped && !dropped.address ? t('Finding the address…') : t('Street, town')} aria-label={t('Address')} maxLength={200} onChange={event => setOther({ ...other, address: event.target.value })} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addOther(); } }} />
                <Button size="sm" variant="ghost" iconOnly aria-label={t('Add')} disabled={!other.name.trim()} onClick={addOther}><Plus aria-hidden="true" /></Button>
              </div>
            </div>
            <div>
              <p className="gk-field__label">{t('Your grounds')}</p>
              {chosen.length ? <List label={t('Your grounds')}>{chosen.map((ground, index) => <li key={ground.id} className="gk-boxedit__row"><div className="gk-list-row" style={{ flex: 1 }}><span className="gk-list-row__lead"><span className="gk-club-icon"><MapPin aria-hidden="true" /></span></span><span className="gk-list-row__main"><span className="gk-list-row__title">{ground.name}</span><span className="gk-list-row__meta">{ground.id === placing?.id ? t('Tap its spot on the map') : ground.address}</span></span></div><Button size="sm" variant="ghost" iconOnly aria-label={t('Remove')} onClick={() => { if (ground.id === placing?.id) setPlacing(null); setChosen(current => current.filter((_, i) => i !== index)); }}><Trash2 aria-hidden="true" /></Button></li>)}</List>
                : <p className="gk-muted">{t('Tap a pitch on the map or in the list.')}</p>}
            </div>
          </div>
        </div>
      </div>
    </SplitPanel>
  );
}
