import { useEffect, useId, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, Loader2, Plus, User, Users } from 'lucide-react';
import { Avatar, Button, ButtonLink, EmptyNote, GkRoot, PageFrame, Panel, Section, Skeleton } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { fetchJoiningChildren, type JoiningChild } from '../../parents/api';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { Crest } from '../../world/Crest';
import { fetchJoinLink, sendJoin, type JoinLink } from '../api';
import { usePagesCopy } from '../copy';
import '../pages.css';

type Who = 'PARENT' | 'PLAYER';
const ADULT = 18;
const ageOn = (birthDate: string) => { const born = new Date(birthDate), now = new Date(); let age = now.getFullYear() - born.getFullYear(); if (now < new Date(now.getFullYear(), born.getMonth(), born.getDate())) age -= 1; return age; };

/**
 * A squad's join link, opened from the parents' WhatsApp group. First "Who are you?": a parent adds their child
 * (and can run things from Parent Hub with a parent account), or the player makes their own card; an adult player
 * can make an account from it. Nothing on the card is public; the coach confirms. Signed in first (the route is protected).
 */
export function JoinPage() {
  const t = usePagesCopy();
  const { code = '' } = useParams<{ code: string }>();
  const [link, setLink] = useState<JoinLink | null>(null);
  const [failed, setFailed] = useState('');
  const [who, setWho] = useState<Who | null>(null);
  const [card, setCard] = useState({ first: '', last: '', gender: null as 'MALE' | 'FEMALE' | null, birthDate: '', consent: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ squadName: string | null } | null>(null);
  // A parent who already has children picks one (F33: which child first); "new" types a new one.
  const { sessionId } = useAuth();
  const [kids, setKids] = useState<JoiningChild[]>([]);
  const [picked, setPicked] = useState<number | 'new' | null>(null);
  const chosen = typeof picked === 'number' ? kids.find(kid => kid.playerId === picked) : undefined;
  useEffect(() => {
    if (who !== 'PARENT') return;
    const controller = new AbortController();
    fetchJoiningChildren(sessionId, controller.signal).then(found => { if (!controller.signal.aborted) setKids(found.children); }).catch(() => { /* New child only. */ });
    return () => controller.abort();
  }, [who, sessionId]);
  const typing = who !== 'PARENT' || !kids.length || picked === 'new';
  const id = useId();
  useEffect(() => {
    const controller = new AbortController();
    fetchJoinLink(code, controller.signal).then(found => { if (!controller.signal.aborted) setLink(found); }).catch(failure => { if (!controller.signal.aborted) setFailed(extractApiErrorMessage(failure, t('This join link has expired. Ask the coach for a new one.'))); });
    return () => controller.abort();
  }, [code, t]);
  const adult = card.birthDate ? ageOn(card.birthDate) >= ADULT : false;
  const ready = chosen ? card.consent : !typing ? false : card.first.trim() && card.birthDate && (who === 'PLAYER' || card.consent);
  const submit = async () => {
    if (busy || !ready) return;
    setBusy(true); setError('');
    try {
      const [first, ...rest] = chosen ? chosen.identity.fullName.split(' ') : [];
      const sent = chosen ? await sendJoin(code, { playerId: chosen.playerId, childFirstName: first, childLastName: rest.join(' '), childGender: chosen.identity.gender, birthDate: chosen.identity.dateOfBirth ?? '', consent: true })
        : await sendJoin(code, { childFirstName: card.first.trim(), childLastName: card.last.trim(), childGender: card.gender, birthDate: card.birthDate, consent: true });
      setDone({ squadName: sent.squadName });
    }
    // A grown-up on a youth squad's link: the squad decides, not the form.
    catch (failure) { setError(who === 'PLAYER' && adult ? t('This link is for {squad}. Ask the coach for the right squad’s link.', { squad: link?.squad.name ?? '' }) : extractApiErrorMessage(failure, t('Could not send. Try again.'))); }
    finally { setBusy(false); }
  };
  const header = link && <div className="gk-cmatch__page"><Crest src={link.page.crestUrl} name={link.page.name} size={44} /><span className="gk-cmatch__text"><strong><Link to={link.page.profilePath}>{link.page.name}</Link></strong><small>{[link.squad.name, link.page.town].join(' · ')}</small></span></div>;
  const body = failed ? <Panel><EmptyNote title={failed} action={<ButtonLink to="/world/clubs">{t('Find your club')}</ButtonLink>} /></Panel>
    : !link ? <div className="gk-stack gk-stack--tight" role="status"><Skeleton height={56} /><Skeleton height={44} /><Skeleton height={44} /></div>
    : done ? <Panel padded>
      <div className="gk-cmatch__page"><span className="gk-ghost__icon"><Check aria-hidden="true" /></span><span className="gk-cmatch__text"><strong>{t('{child} is on the list for {squad}', { child: chosen ? chosen.identity.fullName.split(' ')[0] : card.first.trim(), squad: done.squadName ?? link.squad.name })}</strong><small>{t('The coach confirms. Nothing is public.')}</small></span></div>
      <div className="gk-boxedit__foot" style={{ marginTop: 12 }}>
        {who === 'PLAYER' && adult && <ButtonLink variant="primary" to={`/signup?next=${encodeURIComponent(link.page.profilePath)}`}>{t('Create your account')}</ButtonLink>}
        {who === 'PARENT' && <ButtonLink variant="primary" to={chosen ? `/parent?player=${chosen.playerId}` : '/parent'}>{t('Open Parent Hub')}</ButtonLink>}
        <ButtonLink variant={who === 'PARENT' || adult ? 'ghost' : 'primary'} to={link.page.profilePath}>{t('Open {name}', { name: link.page.name })}</ButtonLink>
      </div>
    </Panel>
    : !who ? <Panel padded>
      {header}
      {/* The one question the link asks: the parent's door and the player's own. Each is a tile with a picture, no reading. */}
      <div className="gk-ctiles gk-ctiles--two" role="group" aria-label={t('Who are you?')} style={{ marginTop: 16 }}>
        <button type="button" className="gk-ctile" onClick={() => setWho('PARENT')}><span className="gk-ctile__icon"><Users aria-hidden="true" /></span><span className="gk-ctile__label">{t('I am a parent')}</span><span className="gk-ghost__hint">{t('I add my child')}</span></button>
        <button type="button" className="gk-ctile" onClick={() => setWho('PLAYER')}><span className="gk-ctile__icon"><User aria-hidden="true" /></span><span className="gk-ctile__label">{t('I am the player')}</span><span className="gk-ghost__hint">{t('I make my own card')}</span></button>
      </div>
    </Panel>
    : <Panel padded>
      {header}
      <div className="gk-boxedit" style={{ marginTop: 16 }}>
        {who === 'PARENT' && kids.length > 0 && <div className="gk-ctowns" role="radiogroup" aria-label={t('Which child?')}>
          {kids.map(kid => <button key={kid.playerId} type="button" role="radio" className="gk-chip" aria-checked={picked === kid.playerId} aria-pressed={picked === kid.playerId} onClick={() => setPicked(kid.playerId)}><Avatar name={kid.identity.fullName} size={22} />{kid.identity.fullName.split(' ')[0]}</button>)}
          <button type="button" role="radio" className="gk-chip" aria-checked={picked === 'new'} aria-pressed={picked === 'new'} onClick={() => setPicked('new')}><Plus aria-hidden="true" />{t('New child')}</button>
        </div>}
        {typing && <>
        <div className="gk-boxedit__row">
          <div style={{ flex: 1 }}><label className="gk-field__label" htmlFor={`${id}-first`}>{t(who === 'PARENT' ? 'Child’s first name' : 'Your first name')}</label><input id={`${id}-first`} className="gk-input" autoFocus value={card.first} maxLength={60} autoComplete={who === 'PLAYER' ? 'given-name' : 'off'} onChange={event => setCard({ ...card, first: event.target.value })} /></div>
          <div style={{ flex: 1 }}><label className="gk-field__label" htmlFor={`${id}-last`}>{t('Last name')}</label><input id={`${id}-last`} className="gk-input" value={card.last} maxLength={60} autoComplete={who === 'PLAYER' ? 'family-name' : 'off'} onChange={event => setCard({ ...card, last: event.target.value })} /></div>
        </div>
        <div className="gk-ctowns" role="group" aria-label={t('Plays with')}>
          <button type="button" className="gk-chip" aria-pressed={card.gender === 'MALE'} onClick={() => setCard({ ...card, gender: 'MALE' })}>{t('Boys')}</button>
          <button type="button" className="gk-chip" aria-pressed={card.gender === 'FEMALE'} onClick={() => setCard({ ...card, gender: 'FEMALE' })}>{t('Girls')}</button>
        </div>
        </>}
        {typing && <div><label className="gk-field__label" htmlFor={`${id}-dob`}>{t('Date of birth')}</label><input id={`${id}-dob`} className="gk-input" type="date" value={card.birthDate} max={new Date().toISOString().slice(0, 10)} autoComplete={who === 'PLAYER' ? 'bday' : 'off'} style={{ maxWidth: 200 }} onChange={event => setCard({ ...card, birthDate: event.target.value })} /></div>}
        {who === 'PARENT' && !typing && !chosen ? null : who === 'PARENT'
          ? <label className="gk-row" style={{ gap: 8, alignItems: 'flex-start' }}><input type="checkbox" checked={card.consent} onChange={event => setCard({ ...card, consent: event.target.checked })} style={{ marginTop: 3 }} /><span>{t('I am the parent or guardian and I agree to the club keeping this card.')}</span></label>
          : card.birthDate && !adult ? <p className="gk-field__hint">{t('Under {age}: a parent or the coach confirms your card.', { age: ADULT })}</p> : null}
        {error && <p className="gk-notice gk-notice--warning" role="alert">{error}</p>}
        <div className="gk-boxedit__foot">
          <Button variant="primary" disabled={busy || !ready} onClick={() => void submit()}>{busy ? <Loader2 className="gk-spin" aria-hidden="true" /> : null}{t(who === 'PARENT' ? 'Add my child' : 'Send my card')}</Button>
          <Button variant="ghost" onClick={() => setWho(null)}>{t('Back')}</Button>
        </div>
      </div>
    </Panel>;
  return <GkRoot className="gk-page gk-join"><PageFrame width="profile"><Section title={t('Join {name}', { name: link?.page.name ?? '' })} hint={link ? t('{squad} · {town}', { squad: link.squad.name, town: link.page.town }) : undefined}>{body}</Section></PageFrame></GkRoot>;
}
