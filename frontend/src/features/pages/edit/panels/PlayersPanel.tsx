import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Copy, MessageCircle, Users } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { Avatar, Button, ButtonLink, EmptyNote, List, ListRow } from '../../../../design/primitives';
import { visualColors } from '../../../../styles/visualColors';
import { extractApiErrorMessage } from '../../../../utils/apiError';
import { recordFunnelEvent } from '../../../feed/feedEvents';
import { decideArrival, ensureJoinLinks, fetchArrivals, type Arrival } from '../../api';
import { usePagesCopy } from '../../copy';
import { useGuideTask } from '../../guide/bridge';
import { usePageEdit } from '../context';
import { SplitPanel } from '../SplitPanel';

/**
 * Players by sharing: one join link per squad for the parents' WhatsApp group (and its QR code for the training
 * ground). Each parent sends a private request; the club offers a configured place and the family confirms its terms.
 */
export function PlayersPanel() {
  const t = usePagesCopy();
  const { page, saveBox, closePanel, openPanel, replace } = usePageEdit();
  const navigate = useNavigate();
  const squads = page?.boxes.squads.items ?? [];
  const [chosen, setChosen] = useState<number | null>(squads[0]?.id ?? null);
  const [arrivals, setArrivals] = useState<Arrival[] | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [groups, setGroups] = useState<Record<number, number>>({});
  const [failed, setFailed] = useState('');
  const [reload, setReload] = useState(0);
  const decisionRequests = useRef(new Map<string, string>());
  const [busy, setBusy] = useState(false);
  const ref = page?.ref;
  const refType = ref?.type, refId = ref?.id, status = page?.status;
  useEffect(() => {
    if (!refType || !refId || status !== 'LIVE') return;
    const controller = new AbortController();
    const target = { type: refType, id: refId };
    ensureJoinLinks(target, controller.signal).then(updated => { if (!controller.signal.aborted) replace(updated); return fetchArrivals(target, controller.signal); })
      .then(list => { if (!controller.signal.aborted) { setArrivals(list); setFailed(''); } })
      .catch(failure => { if (!controller.signal.aborted) setFailed(extractApiErrorMessage(failure, t('Could not load joining requests. Try again.'))); });
    return () => controller.abort();
  }, [refType, refId, status, replace, reload, t]);
  useGuideTask('players', {
    disabled: busy || !page?.boxes.squads.items.length || page.status !== 'LIVE' || arrivals === null || Boolean(failed),
    nextLabel: t('I shared the link'),
    next: async () => ({ status: await shared('guide') ? 'complete' : 'stay' }),
  });
  if (!page) return null;
  if (page.status !== 'LIVE') return <SplitPanel title={t('Invite the players')} onClose={closePanel}><p>{t('Publish the club before sharing invitations.')}</p><Button onClick={() => openPanel('live')}>{t('Go live')}</Button></SplitPanel>;
  const links = page.boxes.players.links;
  const url = (squadId: number) => `${window.location.origin}/join/${links[squadId] ?? ''}`;
  const shared = async (via: string) => {
    const ok = page.boxes.players.shared || await saveBox('players', { shared: true }, { undoable: false });
    if (ok) recordFunnelEvent('PAGE_SHARED', { via, box: 'players', pageRef: `${page.ref.type}-${page.ref.id}` });
    return ok;
  };
  const copy = async (squadId: number) => {
    try { await navigator.clipboard.writeText(url(squadId)); setCopied(squadId); window.setTimeout(() => setCopied(null), 2000); await shared('copy'); } catch { setCopied(null); }
  };
  const decide = async (arrival: Arrival, action: 'APPROVE' | 'REVIEW' | 'DECLINE') => {
    setBusy(true);
    try {
      const groupId = groups[arrival.id] ?? (arrival.groups.length === 1 ? arrival.groups[0].id : undefined);
      const groupVersion = arrival.groups.find(group => group.id === groupId)?.version;
      const key = JSON.stringify([arrival.id, arrival.version, action, groupId, groupVersion]);
      if (!decisionRequests.current.has(key)) decisionRequests.current.set(key, crypto.randomUUID());
      const result = await decideArrival(page.ref, arrival.id, { requestId: decisionRequests.current.get(key)!, expectedVersion: arrival.version, action, groupId, groupVersion });
      replace(result.page); setArrivals(current => current?.filter(item => item.id !== arrival.id) ?? null);
      toast(t(result.outcome === 'PLACE_OFFERED' ? 'Place offered. The family confirms the terms.' : result.outcome === 'REVIEW_REQUIRED' ? 'Request ready for admissions review.' : 'Declined'));
      if (result.outcome === 'REVIEW_REQUIRED') navigate(result.destination);
    }
    catch (error) { toast.error(extractApiErrorMessage(error, t('Try again'))); }
    finally { setBusy(false); }
  };
  const waiting = arrivals ?? [];
  const current = squads.find(squad => squad.id === chosen) ?? squads[0];
  return (
    <SplitPanel title={t('Invite the players')} description={t('Share one link in each squad’s WhatsApp group. Every parent adds their own child; you confirm.')} onClose={closePanel}
      footer={<Button variant="primary" onClick={closePanel}>{t('Done')}</Button>}
      preview={squads.length ? <div className="gk-boxedit">
        {current && links[current.id] && <div className="gk-crest-preview"><QRCodeSVG value={url(current.id)} size={132} bgColor={visualColors.paper} fgColor={visualColors.qrInk} /><span className="gk-muted">{t('{squad} · for the training ground', { squad: current.name })}</span></div>}
        <p className="gk-field__label">{t('Arriving')}</p>
        {failed ? <div role="alert"><p>{failed}</p><Button size="sm" onClick={() => setReload(value => value + 1)}>{t('Retry')}</Button></div> : arrivals === null ? <p role="status">{t('Loading joining requests…')}</p> : waiting.length === 0 ? <p className="gk-muted">{t('No joining requests waiting.')}</p> : <List label={t('Arriving')}>{waiting.map(arrival => (
          <li key={arrival.id} className="gk-boxedit__row">
            <div className="gk-list-row" style={{ flex: 1 }}><Avatar name={`${arrival.childFirstName} ${arrival.childLastName}`} size={32} /><span className="gk-list-row__main"><span className="gk-list-row__title">{arrival.childFirstName} {arrival.childLastName}</span><span className="gk-list-row__meta">{[String(arrival.birthYear), arrival.squadName, t('added by {name}', { name: arrival.guardianName })].filter(Boolean).join(' · ')}</span></span></div>
            {arrival.groups.length > 1 && <select className="gk-input" aria-label={t('Joining group for {name}', { name: arrival.childFirstName })} value={groups[arrival.id] ?? ''} onChange={event => setGroups(current => ({ ...current, [arrival.id]: Number(event.target.value) }))}><option value="">{t('Choose a joining group')}</option>{arrival.groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select>}
            {arrival.groups.length ? <Button size="sm" variant="primary" disabled={busy || (arrival.groups.length > 1 && !groups[arrival.id])} onClick={() => void decide(arrival, (arrival.groups.find(group => group.id === (groups[arrival.id] ?? arrival.groups[0].id))?.method === 'DIRECT') ? 'APPROVE' : 'REVIEW')}>{t((arrival.groups.find(group => group.id === (groups[arrival.id] ?? arrival.groups[0].id))?.method === 'DIRECT') ? 'Offer a place' : 'Review joining')}</Button> : <ButtonLink size="sm" to={arrival.destination}>{t('Set up joining')}</ButtonLink>}
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void decide(arrival, 'DECLINE')}>{t('Decline')}</Button>
          </li>
        ))}</List>}
        {arrivals && page.boxes.players.waiting > arrivals.length && <ButtonLink size="sm" to={`/clubs/${page.clubId}/workspace?tab=admissions`}>{t('View all joining requests')}</ButtonLink>}
      </div> : undefined}>
      {squads.length === 0
        ? <EmptyNote title={t('Add your teams first')} action={<Button size="sm" variant="primary" onClick={() => openPanel('squads')}>{t('Which teams?')}</Button>}>{t('Each team gets its own join link.')}</EmptyNote>
        : <div className="gk-boxedit">
          <List label={t('Join links')}>{squads.map(squad => (
            <ListRow key={squad.id} onClick={() => setChosen(squad.id)} current={squad.id === current?.id} lead={<span className="gk-club-icon"><Users aria-hidden="true" /></span>} title={squad.name}
              meta={squad.players ? t('{n} players', { n: squad.players }) : t('No players yet')}
              trail={<span className="gk-row" onClick={event => event.stopPropagation()}>
                <Button size="sm" iconOnly aria-label={t('Copy link')} title={t('Copy link')} disabled={!links[squad.id] || Boolean(failed)} onClick={() => void copy(squad.id)}>{copied === squad.id ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}</Button>
                {links[squad.id] && !failed && <a className="gk-btn gk-btn--secondary gk-btn--sm" href={`https://wa.me/?text=${encodeURIComponent(t('Add your child to {squad} at {page}: {url}', { squad: squad.name, page: page.identity.name, url: url(squad.id) }))}`} target="_blank" rel="noopener noreferrer" onClick={() => void shared('whatsapp')}><MessageCircle aria-hidden="true" />WhatsApp</a>}
              </span>} />
          ))}</List>
          {page.clubId && <ButtonLink variant="ghost" to={`/clubs/${page.clubId}/squads${current ? `?squad=${current.id}` : ''}`}>{t('Manage squad roster')}</ButtonLink>}
        </div>}
    </SplitPanel>
  );
}
