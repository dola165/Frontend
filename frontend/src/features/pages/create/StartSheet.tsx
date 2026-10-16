import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { Check, Loader2, Lock, MapPin } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { getAuthFlow } from '../../../utils/authRedirect';
import { Dialog } from '../../../design/Dialog';
import { Button, ButtonLink } from '../../../design/primitives';
import { recordFunnelEvent } from '../../feed/feedEvents';
import { isRecord, readSetupRecovery, writeSetupRecovery, clearSetupRecovery } from '../../organizations/setup/setupRecovery';
import { fetchFeedPreferences } from '../../start/startApi';
import { DEFAULT_TOWN, TOWNS, townByName, type Town } from '../../start/towns';
import { Crest } from '../../world/Crest';
import { fetchSimilar, type PageRef, type SimilarPage } from '../api';
import { usePagesCopy } from '../copy';
import { CREATABLE_KINDS, minimumAge, type PageKind } from '../model/kinds';
import { nameKey } from '../model/nameMatch';
import { FOOTBALL_ENTRIES, pagePath, type CreateFrom } from './entry';
import { KIND_TILES } from './kindTiles';
import { useCreatePage } from './useCreatePage';
import '../pages.css';

interface StartDraft { kind: PageKind | null; name: string; town: string }
const DRAFT = 'page-start';
const validDraft = (value: unknown): value is StartDraft => isRecord(value) && typeof value.name === 'string' && value.name.length <= 120 && typeof value.town === 'string' && (value.kind === null || CREATABLE_KINDS.includes(value.kind as PageKind));
const KIND_WORD: Record<PageKind, string> = { CLUB: 'Club', FAN_CLUB: 'Fan club', BUSINESS: 'Sponsor or business', PAGE: 'Other page', VENUE: 'Venue' };

/**
 * The start sheet, about ten seconds: what it is (four picture tiles), its name with the town already filled in, and
 * Create. While the name is typed, known pages that look like it are shown with "Claim it", so a copy of a known club
 * goes to that club and never becomes a second page. Nothing else is asked here.
 */
export function StartSheet({ kind, from, draw, onClose, onClaim }: { kind: PageKind | null; from: CreateFrom; draw: boolean; onClose: () => void; onClaim: (ref: PageRef) => void }) {
  const t = usePagesCopy();
  const { user } = useAuth();
  const { create, busy, error, clearError, unanswered, age } = useCreatePage();
  const locked = (candidate: PageKind) => age != null && age < minimumAge(candidate);
  // A draft left in the sheet comes back, unless the link asks for another kind: then it starts afresh on that kind.
  const [draft] = useState(() => { const kept = readSetupRecovery(user?.id, DRAFT, validDraft); return kept && (!kind || kept.kind === kind) ? kept : null; });
  const preset = kind ?? (FOOTBALL_ENTRIES.includes(from) ? 'CLUB' : null);
  const [chosen, setChosen] = useState<PageKind | null>(() => { const start = kind ?? draft?.kind ?? preset; return start && !locked(start) ? start : null; });
  const [name, setName] = useState(draft?.name ?? '');
  // The town is the one the person picked here, else the one they registered with, else the one they chose at the start.
  const [town, setTown] = useState<Town>(() => townByName(draft?.town) ?? townByName(getAuthFlow().town) ?? DEFAULT_TOWN);
  const [townPicked, setTownPicked] = useState(Boolean(townByName(draft?.town)));
  const [townOpen, setTownOpen] = useState(false);
  const [found, setFound] = useState<{ key: string; items: SimilarPage[] } | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const nameId = useId();

  useEffect(() => { recordFunnelEvent('PAGE_CREATE_OPENED', { from }); }, [from]);
  // The town already filled in: the one the person chose at the start, else where they registered.
  useEffect(() => {
    if (townByName(draft?.town)) return;
    const controller = new AbortController();
    fetchFeedPreferences(controller.signal).then(prefs => { const known = townByName(prefs.town?.name); if (known && !controller.signal.aborted) setTown(known); }).catch(() => undefined);
    return () => controller.abort();
  }, [draft?.town]);
  useEffect(() => { writeSetupRecovery(user?.id, DRAFT, { kind: chosen, name, town: townPicked ? town.name : '' } satisfies StartDraft); }, [chosen, name, town.name, townPicked, user?.id]);
  // The dialog puts focus on its first control; once a type is chosen the name is what matters.
  // A restored draft is selected so typing replaces it; an empty field is only focused, so no keystroke is swallowed.
  useEffect(() => { if (chosen) { const frame = requestAnimationFrame(() => { const field = nameRef.current; if (!field) return; field.focus(); if (field.value) field.select(); }); return () => cancelAnimationFrame(frame); } }, [chosen]);
  // The duplicate check while typing, a breath after the last key. What was found is kept with the name it was found for.
  const typed = name.trim();
  const lookupKey = chosen && typed.length >= 3 ? `${chosen}:${typed}` : null;
  useEffect(() => {
    if (!lookupKey) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetchSimilar(typed, town.name, controller.signal).then(items => { if (!controller.signal.aborted) setFound({ key: lookupKey, items }); }).catch(() => undefined);
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [lookupKey, typed, town.name]);
  const matches = found && (found.key === lookupKey || found.key === 'exists') ? found.items : [];

  const choose = (next: PageKind) => {
    if (locked(next)) { setNote(t('From {age}: ask an adult at the club to create it and invite you.', { age: minimumAge(next) })); return; }
    setNote(''); clearError(); setChosen(next);
    recordFunnelEvent('PAGE_TYPE_CHOSEN', { kind: next, from });
  };
  const exact = matches.find(match => match.exact) ?? null;
  const shown = dismissed === nameKey(name) && !exact ? [] : matches.slice(0, 3);
  const ready = Boolean(chosen) && name.trim().length >= 2 && !busy && !exact;
  const submit = async () => {
    if (!chosen || !ready) return;
    const outcome = await create({ kind: chosen, name, town, from, draw });
    if (outcome.kind === 'created') clearSetupRecovery(user?.id, DRAFT);
    if (outcome.kind === 'exists') { setFound({ key: 'exists', items: [outcome.match] }); setDismissed(null); }
  };
  const onKey = (event: KeyboardEvent<HTMLInputElement>) => { if (event.key === 'Enter') { event.preventDefault(); void submit(); } };
  const tile = chosen ? KIND_TILES[chosen as Exclude<PageKind, 'VENUE'>] : null;
  const matchAction = (match: SimilarPage) => match.mine
    ? <ButtonLink size="sm" to={pagePath(match.ref)} onClick={onClose}>{t('Open yours')}</ButtonLink>
    : match.claim === 'UNCLAIMED' ? <Button size="sm" variant="primary" onClick={() => onClaim(match.ref)}>{t('Claim it')}</Button>
    : <ButtonLink size="sm" to={pagePath(match.ref)} onClick={onClose}>{t('Open')}</ButtonLink>;

  return (
    <Dialog open size="md" title={tile ? t(tile.title) : t('What are you creating?')} onClose={onClose} closeLabel={t('Not now')}
      footer={<>
        <Button variant="ghost" onClick={onClose}>{t('Not now')}</Button>
        {exact ? matchAction(exact) : <Button variant="primary" disabled={!ready} onClick={() => void submit()}>
          {busy ? <><Loader2 className="gk-spin" aria-hidden="true" />{t('Creating…')}</> : t(tile?.create ?? 'Create page')}
        </Button>}
      </>}>
      <div className="gk-ctiles" role="radiogroup" aria-label={t('What are you creating?')}>
        {CREATABLE_KINDS.map(candidate => {
          const item = KIND_TILES[candidate as Exclude<PageKind, 'VENUE'>], shut = locked(candidate);
          return (
            <button key={candidate} type="button" role="radio" aria-checked={chosen === candidate} aria-disabled={shut || undefined} className="gk-ctile"
              aria-label={t(item.label)} aria-describedby={`${nameId}-${candidate}`}
              style={{ '--tile-photo': `url(${item.photo})`, '--tile-position': item.position ?? 'center', '--tile': item.color } as CSSProperties} onClick={() => choose(candidate)}>
              <span className="gk-ctile__icon"><item.icon aria-hidden="true" /></span>
              <span className="gk-ctile__label">{t(item.label)}</span>
              <span className="gk-ctile__hint" id={`${nameId}-${candidate}`}>{shut ? t('From {age}', { age: minimumAge(candidate) }) : t(item.hint)}</span>
              {shut ? <span className="gk-ctile__lock"><Lock aria-hidden="true" /></span> : <span className="gk-ctile__tick" aria-hidden="true"><Check /></span>}
            </button>
          );
        })}
      </div>
      {note && <p className="gk-notice gk-notice--warning" role="status">{note}</p>}
      {chosen && tile && (
        <div className="gk-cname">
          <label className="gk-field__label" htmlFor={nameId}>{t(tile.nameLabel)}</label>
          <div className="gk-cname__row">
            <input id={nameId} ref={nameRef} className="gk-input" value={name} maxLength={120} autoComplete="organization" placeholder={tile.placeholder}
              aria-describedby={shown.length ? `${nameId}-match` : undefined} onChange={event => { setName(event.target.value); clearError(); setFound(current => (current?.key === 'exists' ? null : current)); }} onKeyDown={onKey} />
            <button type="button" className="gk-chip gk-cname__town" aria-expanded={townOpen} aria-label={t('Change town')} onClick={() => setTownOpen(open => !open)}>
              <MapPin aria-hidden="true" />{town.name}
            </button>
          </div>
          {townOpen && (
            <ul className="gk-ctowns" aria-label={t('Town')}>
              {TOWNS.map(item => <li key={item.name}><button type="button" className="gk-chip" aria-pressed={item.name === town.name} onClick={() => { setTown(item); setTownPicked(true); setTownOpen(false); nameRef.current?.focus(); }}>{item.name}</button></li>)}
            </ul>
          )}
          {shown.length > 0 && (
            <div className="gk-cmatch" id={`${nameId}-match`} role="status">
              <p className="gk-cmatch__title">{exact ? t('This is already on GrassKickZ') : t(chosen === 'CLUB' ? 'Is this your club?' : 'Is this your page?')}</p>
              <ul>{shown.map(match => (
                <li key={`${match.ref.type}-${match.ref.id}`}>
                  <Crest src={match.crestUrl} name={match.name} size={36} />
                  <span className="gk-cmatch__text"><span>{match.name}</span><small>{[match.town, t(KIND_WORD[match.kind]), match.claim === 'UNCLAIMED' ? t('Unclaimed') : null].filter(Boolean).join(' · ')}</small></span>
                  {matchAction(match)}
                </li>
              ))}</ul>
              {!exact && <button type="button" className="gk-cmatch__no" onClick={() => setDismissed(nameKey(name))}>{t('No, mine is different')}</button>}
            </div>
          )}
          {(error || unanswered) && <p className={`gk-notice${error ? ' gk-notice--warning' : ''}`} role="alert">{error || t('The last try was not answered. Try again with the same name; it never makes two pages.')}</p>}
        </div>
      )}
    </Dialog>
  );
}
