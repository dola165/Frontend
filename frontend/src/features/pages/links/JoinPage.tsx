import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { CalendarDays, Check, Loader2, User, Users } from 'lucide-react';
import { Avatar, Button, ButtonLink, EmptyNote, GkRoot, PageFrame, Panel, Section, Skeleton } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { fetchJoiningChildren, type JoiningChild } from '../../parents/api';
import { extractApiErrorCode, extractApiErrorMessage } from '../../../utils/apiError';
import { buildLoginRedirectPath, buildSignupPath } from '../../../utils/authRedirect';
import { formatDate } from '../../../utils/formatting';
import { Crest } from '../../world/Crest';
import { fetchJoinLink, sendJoin, type JoinLink, type JoinSendBody, type JoinSent } from '../api';
import { usePagesCopy } from '../copy';
import '../pages.css';
import './join.css';

type Who = 'PARENT' | 'PLAYER';
const ADULT = 18;
const WHO: Record<string, Who> = { child: 'PARENT', me: 'PLAYER' };
const ageOn = (birthDate: string) => { const born = new Date(birthDate), now = new Date(); let age = now.getFullYear() - born.getFullYear(); if (now < new Date(now.getFullYear(), born.getMonth(), born.getDate())) age -= 1; return age; };
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? '';
const today = () => new Date().toISOString().slice(0, 10);

/**
 * A squad's join link, shared in the parents' WhatsApp group or as a printed QR code. One question: "Who's joining?
 * Me · My child". The choice lives in the address (`who=me|child`), so signing in or up comes straight back to it.
 * "My child" asks only the child's name and birth date; the server reuses the parent's own child with those details,
 * and offers a child another parent already added ("Is this Luka…?") instead of making a second card. A grown-up
 * choosing "Me" for a youth squad is asked "Joining for your child?". The coach confirms; nothing is public.
 */
export function JoinPage() {
  const t = usePagesCopy();
  const { code = '' } = useParams<{ code: string }>();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const who = WHO[params.get('who') ?? ''] ?? null;
  const choose = (next: Who | null) => setParams(previous => { const out = new URLSearchParams(previous); if (next) out.set('who', next === 'PARENT' ? 'child' : 'me'); else out.delete('who'); return out; });
  const [link, setLink] = useState<JoinLink | null>(null);
  const [failed, setFailed] = useState('');
  const { sessionId, isAuthenticated, isBootstrapping, user } = useAuth();
  const [child, setChild] = useState({ name: '', birthDate: '', consent: false });
  const [birthDate, setBirthDate] = useState('');
  const [needsBirth, setNeedsBirth] = useState(false);
  const [forChild, setForChild] = useState(false);
  const [same, setSame] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState<JoinSent | null>(null);
  const request = useRef<{ key: string; id: string } | null>(null);
  const [kids, setKids] = useState<JoiningChild[]>([]);
  const id = useId();
  useEffect(() => {
    const controller = new AbortController();
    fetchJoinLink(code, controller.signal).then(found => { if (!controller.signal.aborted) setLink(found); }).catch(() => { if (!controller.signal.aborted) setFailed(t('This join link has expired. Ask the coach for a new one.')); });
    return () => controller.abort();
  }, [code, t]);
  // The parent's own children, as shortcuts that fill the name and birth date. Not loading them changes nothing.
  useEffect(() => {
    if (who !== 'PARENT' || !isAuthenticated || !link) return;
    const controller = new AbortController();
    fetchJoiningChildren(sessionId, controller.signal).then(found => { if (!controller.signal.aborted) setKids(found.children.filter(kid => kid.identity.dateOfBirth && !kid.clubs.some(club => club.clubId === link.page.ref.id && club.squadNames.includes(link.squad.name)))); }).catch(() => undefined);
    return () => controller.abort();
  }, [who, isAuthenticated, sessionId, link]);

  const myAge = user?.dob ? ageOn(user.dob) : null;
  const youthUnder = link?.squad.youthUnder ?? null;
  // Asked before sending when the page can tell; the server asks the same (JOINING_FOR_CHILD) when it cannot.
  const tooOld = who === 'PLAYER' && (forChild || (youthUnder != null && myAge != null && myAge >= ADULT && myAge >= youthUnder));
  const choosing = (next: Who | null) => { setError(''); setSame(null); setForChild(false); choose(next); };

  const send = async (body: Omit<JoinSendBody, 'requestId' | 'consent'>) => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const key = JSON.stringify([code, body]);
      if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() };
      setSent(await sendJoin(code, { ...body, consent: true, requestId: request.current.id }));
    } catch (failure) {
      const problem = extractApiErrorCode(failure);
      if (problem === 'CHILD_ALREADY_LISTED') setSame(firstName(body.childName ?? ''));
      else if (problem === 'JOINING_FOR_CHILD') setForChild(true);
      else if (problem === 'BIRTH_DATE_NEEDED') setNeedsBirth(true);
      else setError(extractApiErrorMessage(failure, t('Could not send. Try again.')));
    } finally { setBusy(false); }
  };
  const sendChild = (sameChild?: boolean) => send({ who: 'PARENT', childName: child.name.trim().replace(/\s+/g, ' '), birthDate: child.birthDate, ...(sameChild === undefined ? {} : { sameChild }) });
  const askBirth = needsBirth || !user?.dob;
  const back = <Button variant="ghost" onClick={() => choosing(null)}>{t('Back')}</Button>;
  const failure = error && <p className="gk-notice gk-notice--warning" role="alert">{error}</p>;
  const spinner = busy ? <Loader2 className="gk-spin" aria-hidden="true" /> : null;
  const header = link && <div className="gk-cmatch__page"><Crest src={link.page.crestUrl} name={link.page.name} size={44} /><span className="gk-cmatch__text"><strong><Link to={link.page.profilePath}>{link.page.name}</Link></strong><small>{[link.squad.name, link.page.town].join(' · ')}</small></span></div>;

  const body = failed ? <Panel><EmptyNote title={failed} action={<ButtonLink to="/world/clubs">{t('Find your club')}</ButtonLink>} /></Panel>
    : !link || isBootstrapping ? <div className="gk-stack gk-stack--tight" role="status"><Skeleton height={56} /><Skeleton height={44} /><Skeleton height={44} /></div>
    : sent ? <Panel padded><JoinSentView sent={sent} who={who} link={link} /></Panel>
    : !who ? <Panel padded>
      {header}
      <h2 className="gk-join__question">{t('Who’s joining?')}</h2>
      <div className="gk-ctiles gk-ctiles--two" role="group" aria-label={t('Who’s joining?')}>
        <button type="button" className="gk-ctile" onClick={() => choosing('PLAYER')}><span className="gk-ctile__icon"><User aria-hidden="true" /></span><span className="gk-ctile__label">{t('Me')}</span><span className="gk-ghost__hint">{t('I play')}</span></button>
        <button type="button" className="gk-ctile" onClick={() => choosing('PARENT')}><span className="gk-ctile__icon"><Users aria-hidden="true" /></span><span className="gk-ctile__label">{t('My child')}</span><span className="gk-ghost__hint">{t('Name and birth date')}</span></button>
      </div>
      <p className="gk-field__hint gk-join__note">{t('The coach confirms. Nothing is public.')}</p>
    </Panel>
    : !isAuthenticated ? <Panel padded>
      {header}
      <p className="gk-join__lead">{t(who === 'PARENT' ? 'Sign in or create an account, then add your child. You come straight back here.' : 'Sign in or create an account to ask for a place. You come straight back here.')}</p>
      <div className="gk-boxedit__foot">
        <ButtonLink variant="primary" to={buildLoginRedirectPath(location.pathname, location.search, location.hash)}>{t('Sign in')}</ButtonLink>
        <ButtonLink to={buildSignupPath(`${location.pathname}${location.search}${location.hash}`)}>{t('Create an account')}</ButtonLink>
        {back}
      </div>
    </Panel>
    : tooOld ? <Panel padded>
      {header}
      <h2 className="gk-join__question">{t('Joining for your child?')}</h2>
      <p className="gk-join__lead">{youthUnder ? t('{squad} is for players under {age}.', { squad: link.squad.name, age: youthUnder }) : t('This squad is for young players.')}</p>
      <div className="gk-boxedit__foot"><Button variant="primary" onClick={() => choosing('PARENT')}>{t('Yes, my child')}</Button>{back}</div>
    </Panel>
    : same !== null ? <Panel padded>
      {header}
      <h2 className="gk-join__question">{t('Is this {name}, added by another parent?', { name: same })}</h2>
      <p className="gk-join__lead">{t('{name} is already on the list. If this is your child, the parent who added them confirms you. They see your name; you see nothing about them.', { name: same })}</p>
      {failure}
      <div className="gk-boxedit__foot">
        <Button variant="primary" disabled={busy} onClick={() => void sendChild(true)}>{spinner}{t('Yes, that’s my child')}</Button>
        <Button disabled={busy} onClick={() => void sendChild(false)}>{t('No, a different child')}</Button>
        <Button variant="ghost" onClick={() => setSame(null)}>{t('Back')}</Button>
      </div>
    </Panel>
    : who === 'PLAYER' ? <Panel padded>
      {header}
      <div className="gk-boxedit gk-join__form">
        <div className="gk-cmatch__page"><Avatar name={user?.fullName ?? user?.name ?? ''} size={36} /><span className="gk-cmatch__text"><strong>{user?.fullName ?? user?.name}</strong><small>{t('Asks to join {squad}', { squad: link.squad.name })}</small></span></div>
        {askBirth && <div><label className="gk-field__label" htmlFor={`${id}-me-dob`}>{t('Date of birth')}</label><input id={`${id}-me-dob`} className="gk-input gk-join__date" type="date" value={birthDate} max={today()} autoComplete="bday" onChange={event => setBirthDate(event.target.value)} /></div>}
        {myAge != null && myAge < ADULT && <p className="gk-field__hint">{t('Under {age}: a parent or guardian confirms the joining terms.', { age: ADULT })}</p>}
        {failure}
        <div className="gk-boxedit__foot">
          <Button variant="primary" disabled={busy || (askBirth && !birthDate)} onClick={() => void send({ who: 'PLAYER', ...(birthDate ? { birthDate } : {}) })}>{spinner}{t('Send my request')}</Button>
          {back}
        </div>
      </div>
    </Panel>
    : <Panel padded>
      {header}
      <div className="gk-boxedit gk-join__form">
        {kids.length > 0 && <div className="gk-ctowns" role="group" aria-label={t('Your children')}>
          {kids.map(kid => <button key={kid.playerId} type="button" className="gk-chip" aria-pressed={child.name === kid.identity.fullName && child.birthDate === kid.identity.dateOfBirth} onClick={() => setChild({ ...child, name: kid.identity.fullName, birthDate: kid.identity.dateOfBirth ?? '' })}><Avatar name={kid.identity.fullName} size={22} />{firstName(kid.identity.fullName)}</button>)}
        </div>}
        <div><label className="gk-field__label" htmlFor={`${id}-name`}>{t('Child’s name')}</label><input id={`${id}-name`} className="gk-input" autoFocus value={child.name} maxLength={150} autoComplete="off" onChange={event => setChild({ ...child, name: event.target.value })} /></div>
        <div><label className="gk-field__label" htmlFor={`${id}-dob`}>{t('Date of birth')}</label><input id={`${id}-dob`} className="gk-input gk-join__date" type="date" value={child.birthDate} max={today()} autoComplete="off" onChange={event => setChild({ ...child, birthDate: event.target.value })} /></div>
        <label className="gk-row gk-join__consent"><input type="checkbox" checked={child.consent} onChange={event => setChild({ ...child, consent: event.target.checked })} /><span>{t('I am the parent or guardian and I agree to the club keeping this card.')}</span></label>
        {failure}
        <div className="gk-boxedit__foot">
          <Button variant="primary" disabled={busy || !child.name.trim() || !child.birthDate || !child.consent} onClick={() => void sendChild()}>{spinner}{child.name.trim() ? t('Send for {name}', { name: firstName(child.name) }) : t('Send')}</Button>
          {back}
        </div>
      </div>
    </Panel>;
  return <GkRoot className="gk-page gk-join"><PageFrame width="profile"><Section title={link ? t('Join {name}', { name: link.page.name }) : t('Join link')} hint={link ? t('{squad} · {town}', { squad: link.squad.name, town: link.page.town }) : undefined}>{body}</Section></PageFrame></GkRoot>;
}

/** After sending: who has it now, the squad with its next training, and where to follow the request. */
function JoinSentView({ sent, who, link }: { sent: JoinSent; who: Who | null; link: JoinLink }) {
  const t = usePagesCopy();
  const child = sent.childName ?? '';
  if (sent.status === 'PARENT_LINK_REQUESTED') return <>
    <div className="gk-cmatch__page"><span className="gk-ghost__icon"><Check aria-hidden="true" /></span><span className="gk-cmatch__text"><strong>{t('{name} is already on the list', { name: child })}</strong><small>{t('We asked the parent who added {name} to confirm you. You will get a notice.', { name: child })}</small></span></div>
    <div className="gk-boxedit__foot gk-join__note"><ButtonLink variant="primary" to="/parent">{t('Open Parent Hub')}</ButtonLink><ButtonLink variant="ghost" to={link.page.profilePath}>{t('Open {name}', { name: link.page.name })}</ButtonLink></div>
  </>;
  const training = sent.nextTraining;
  return <>
    <div className="gk-cmatch__page"><span className="gk-ghost__icon"><Check aria-hidden="true" /></span><span className="gk-cmatch__text">
      <strong>{sent.coachName ? t('Sent to coach {name}', { name: firstName(sent.coachName) }) : t('Sent to {club}', { club: sent.clubName })}</strong>
      <small>{who === 'PARENT' && child ? t('{child} · {squad}', { child, squad: sent.squadName }) : sent.squadName}</small></span></div>
    <div className="gk-join__squad">
      <Crest src={link.page.crestUrl} name={link.page.name} size={36} />
      <span className="gk-cmatch__text"><strong>{sent.squadName}</strong><small>{sent.clubName}</small></span>
      <span className="gk-join__training"><CalendarDays aria-hidden="true" /><span><small>{t('Next training')}</small>{training
        ? <><strong>{formatDate(training.startsAt, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</strong><small>{training.title}</small></>
        : <strong>{t('The coach shares it')}</strong>}</span></span>
    </div>
    <p className="gk-field__hint">{t('The coach confirms. Nothing is public.')}</p>
    <div className="gk-boxedit__foot">
      <ButtonLink variant="primary" to={sent.destination ?? '/admissions'}>{t('Follow your request')}</ButtonLink>
      {who === 'PARENT' && <ButtonLink to="/parent">{t('Open Parent Hub')}</ButtonLink>}
      <ButtonLink variant="ghost" to={link.page.profilePath}>{t('Open {name}', { name: link.page.name })}</ButtonLink>
    </div>
  </>;
}
