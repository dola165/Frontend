import { useEffect, useId, useState } from 'react';
import { Check, Copy, MessageCircle, Users } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { Avatar, Button, EmptyNote, List, ListRow } from '../../../../design/primitives';
import { visualColors } from '../../../../styles/visualColors';
import { extractApiErrorMessage } from '../../../../utils/apiError';
import { recordFunnelEvent } from '../../../feed/feedEvents';
import { decideArrival, fetchArrivals, pastePlayers, type Arrival } from '../../api';
import { usePagesCopy } from '../../copy';
import { usePageEdit } from '../context';
import { SplitPanel } from '../SplitPanel';

/**
 * Players by sharing: one join link per squad for the parents' WhatsApp group (and its QR code for the training
 * ground). Each parent adds their own child; the coach confirms here. The fallback is a list of names, one per line.
 */
export function PlayersPanel() {
  const t = usePagesCopy();
  const { page, saveBox, closePanel, openPanel, replace } = usePageEdit();
  const squads = page?.boxes.squads.items ?? [];
  const [chosen, setChosen] = useState<number | null>(squads[0]?.id ?? null);
  const [arrivals, setArrivals] = useState<Arrival[] | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [pasting, setPasting] = useState(false);
  const [names, setNames] = useState('');
  const [busy, setBusy] = useState(false);
  const id = useId();
  const ref = page?.ref;
  useEffect(() => {
    if (!ref) return;
    const controller = new AbortController();
    fetchArrivals(ref, controller.signal).then(list => { if (!controller.signal.aborted) setArrivals(list); }).catch(() => { if (!controller.signal.aborted) setArrivals([]); });
    return () => controller.abort();
  }, [ref]);
  if (!page) return null;
  const links = page.boxes.players.links;
  const url = (squadId: number) => `${window.location.origin}/join/${links[squadId] ?? ''}`;
  const shared = async (via: string) => {
    recordFunnelEvent('PAGE_SHARED', { via, box: 'players', pageRef: `${page.ref.type}-${page.ref.id}` });
    if (!page.boxes.players.shared) await saveBox('players', { shared: true }, { undoable: false });
  };
  const copy = async (squadId: number) => {
    try { await navigator.clipboard.writeText(url(squadId)); setCopied(squadId); window.setTimeout(() => setCopied(null), 2000); await shared('copy'); } catch { setCopied(null); }
  };
  const decide = async (arrival: Arrival, action: 'APPROVE' | 'DECLINE') => {
    setBusy(true);
    try { replace(await decideArrival(page.ref, arrival.id, action)); setArrivals(current => current?.filter(item => item.id !== arrival.id) ?? null); toast(action === 'APPROVE' ? t('{name} is in', { name: arrival.childFirstName }) : t('Declined')); }
    catch (error) { toast.error(extractApiErrorMessage(error, t('Try again'))); }
    finally { setBusy(false); }
  };
  const paste = async () => {
    const list = names.split('\n').map(line => line.trim()).filter(Boolean);
    if (!chosen || !list.length) return;
    setBusy(true);
    try { replace(await pastePlayers(page.ref, chosen, list)); setNames(''); setPasting(false); toast(t('{n} players added', { n: list.length })); }
    catch (error) { toast.error(extractApiErrorMessage(error, t('Try again'))); }
    finally { setBusy(false); }
  };
  const waiting = arrivals ?? [];
  const current = squads.find(squad => squad.id === chosen) ?? squads[0];
  return (
    <SplitPanel title={t('Invite the players')} description={t('Share one link in each squad’s WhatsApp group. Every parent adds their own child; you confirm.')} onClose={closePanel}
      footer={<Button variant="primary" onClick={closePanel}>{t('Done')}</Button>}
      preview={squads.length ? <div className="gk-boxedit">
        {current && <div className="gk-crest-preview"><QRCodeSVG value={url(current.id)} size={132} bgColor={visualColors.paper} fgColor={visualColors.qrInk} /><span className="gk-muted">{t('{squad} · for the training ground', { squad: current.name })}</span></div>}
        <p className="gk-field__label">{t('Arriving')}</p>
        {waiting.length === 0 ? <p className="gk-muted">{t('Nobody has joined through a link yet.')}</p> : <List label={t('Arriving')}>{waiting.map(arrival => (
          <li key={arrival.id} className="gk-boxedit__row">
            <div className="gk-list-row" style={{ flex: 1 }}><Avatar name={`${arrival.childFirstName} ${arrival.childLastName}`} size={32} /><span className="gk-list-row__main"><span className="gk-list-row__title">{arrival.childFirstName} {arrival.childLastName}</span><span className="gk-list-row__meta">{[String(arrival.birthYear), arrival.squadName, t('added by {name}', { name: arrival.guardianName })].filter(Boolean).join(' · ')}</span></span></div>
            <Button size="sm" variant="primary" disabled={busy} onClick={() => void decide(arrival, 'APPROVE')}>{t('Yes')}</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void decide(arrival, 'DECLINE')}>{t('No')}</Button>
          </li>
        ))}</List>}
      </div> : undefined}>
      {squads.length === 0
        ? <EmptyNote title={t('Add your teams first')} action={<Button size="sm" variant="primary" onClick={() => openPanel('squads')}>{t('Which teams?')}</Button>}>{t('Each team gets its own join link.')}</EmptyNote>
        : <div className="gk-boxedit">
          <List label={t('Join links')}>{squads.map(squad => (
            <ListRow key={squad.id} onClick={() => setChosen(squad.id)} current={squad.id === current?.id} lead={<span className="gk-club-icon"><Users aria-hidden="true" /></span>} title={squad.name}
              meta={squad.players ? t('{n} players', { n: squad.players }) : t('No players yet')}
              trail={<span className="gk-row" onClick={event => event.stopPropagation()}>
                <Button size="sm" iconOnly aria-label={t('Copy link')} title={t('Copy link')} onClick={() => void copy(squad.id)}>{copied === squad.id ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}</Button>
                <a className="gk-btn gk-btn--secondary gk-btn--sm" href={`https://wa.me/?text=${encodeURIComponent(t('Add your child to {squad} at {page}: {url}', { squad: squad.name, page: page.identity.name, url: url(squad.id) }))}`} target="_blank" rel="noopener noreferrer" onClick={() => void shared('whatsapp')}><MessageCircle aria-hidden="true" />WhatsApp</a>
              </span>} />
          ))}</List>
          {pasting ? <div className="gk-boxedit">
            <label className="gk-field__label" htmlFor={`${id}-names`}>{t('Names, one per line')}</label>
            <textarea id={`${id}-names`} className="gk-input" rows={5} value={names} placeholder={'Luka Kapanadze\nNino Beridze'} onChange={event => setNames(event.target.value)} />
            <div className="gk-boxedit__row">
              <select className="gk-input" aria-label={t('Team')} value={chosen ?? ''} onChange={event => setChosen(Number(event.target.value))}>{squads.map(squad => <option key={squad.id} value={squad.id}>{squad.name}</option>)}</select>
              <Button size="sm" variant="primary" disabled={busy || !names.trim()} onClick={() => void paste()}>{t('Add')}</Button>
              <Button size="sm" variant="ghost" onClick={() => setPasting(false)}>{t('Cancel')}</Button>
            </div>
            <span className="gk-faint">{t('Private player cards; each family gets a link later.')}</span>
          </div>
            : <button type="button" className="gk-cmatch__no" onClick={() => setPasting(true)}>{t('No WhatsApp group? Paste a list of names')}</button>}
        </div>}
    </SplitPanel>
  );
}
