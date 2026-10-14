import { useEffect, useId, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, Loader2 } from 'lucide-react';
import { Button, ButtonLink, EmptyNote, GkRoot, PageFrame, Panel, Section, Skeleton } from '../../../design/primitives';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { Crest } from '../../world/Crest';
import { fetchJoinLink, sendJoin, type JoinLink } from '../api';
import { usePagesCopy } from '../copy';
import '../pages.css';

/**
 * A parent opening a squad's join link: the club and the squad, then their own child in four fields and the
 * guardian's word. Nothing about the child is public; the coach confirms. Signed in first (the route is protected).
 */
export function JoinPage() {
  const t = usePagesCopy();
  const { code = '' } = useParams<{ code: string }>();
  const [link, setLink] = useState<JoinLink | null>(null);
  const [failed, setFailed] = useState('');
  const [child, setChild] = useState({ first: '', last: '', gender: null as 'MALE' | 'FEMALE' | null, birthDate: '', consent: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ squadName: string | null } | null>(null);
  const id = useId();
  useEffect(() => {
    const controller = new AbortController();
    fetchJoinLink(code, controller.signal).then(found => { if (!controller.signal.aborted) setLink(found); }).catch(failure => { if (!controller.signal.aborted) setFailed(extractApiErrorMessage(failure, t('This join link has expired. Ask the coach for a new one.'))); });
    return () => controller.abort();
  }, [code, t]);
  const submit = async () => {
    if (busy || !child.first.trim() || !child.birthDate || !child.consent) return;
    setBusy(true); setError('');
    try { const sent = await sendJoin(code, { childFirstName: child.first.trim(), childLastName: child.last.trim(), childGender: child.gender, birthDate: child.birthDate, consent: true }); setDone({ squadName: sent.squadName }); }
    catch (failure) { setError(extractApiErrorMessage(failure, t('Could not send. Try again.'))); }
    finally { setBusy(false); }
  };
  const body = failed ? <Panel><EmptyNote title={failed} action={<ButtonLink to="/world/clubs">{t('Find your club')}</ButtonLink>} /></Panel>
    : !link ? <div className="gk-stack gk-stack--tight" role="status"><Skeleton height={56} /><Skeleton height={44} /><Skeleton height={44} /></div>
    : done ? <Panel padded><div className="gk-cmatch__page"><span className="gk-ghost__icon"><Check aria-hidden="true" /></span><span className="gk-cmatch__text"><strong>{t('{child} is on the list for {squad}', { child: child.first.trim(), squad: done.squadName ?? link.squad.name })}</strong><small>{t('The coach confirms. You will see it on your Home.')}</small></span></div>
      <div className="gk-boxedit__foot" style={{ marginTop: 12 }}><ButtonLink variant="primary" to={link.page.profilePath}>{t('Open {name}', { name: link.page.name })}</ButtonLink><ButtonLink variant="ghost" to="/home">{t('Home')}</ButtonLink></div></Panel>
    : <Panel padded>
      <div className="gk-cmatch__page"><Crest src={link.page.crestUrl} name={link.page.name} size={44} /><span className="gk-cmatch__text"><strong><Link to={link.page.profilePath}>{link.page.name}</Link></strong><small>{[link.squad.name, link.page.town].join(' · ')}</small></span></div>
      <div className="gk-boxedit" style={{ marginTop: 16 }}>
        <div className="gk-boxedit__row">
          <div style={{ flex: 1 }}><label className="gk-field__label" htmlFor={`${id}-first`}>{t('Child’s first name')}</label><input id={`${id}-first`} className="gk-input" autoFocus value={child.first} maxLength={60} autoComplete="off" onChange={event => setChild({ ...child, first: event.target.value })} /></div>
          <div style={{ flex: 1 }}><label className="gk-field__label" htmlFor={`${id}-last`}>{t('Last name')}</label><input id={`${id}-last`} className="gk-input" value={child.last} maxLength={60} autoComplete="off" onChange={event => setChild({ ...child, last: event.target.value })} /></div>
        </div>
        <div className="gk-ctowns" role="group" aria-label={t('Plays with')}>
          <button type="button" className="gk-chip" aria-pressed={child.gender === 'MALE'} onClick={() => setChild({ ...child, gender: 'MALE' })}>{t('Boys')}</button>
          <button type="button" className="gk-chip" aria-pressed={child.gender === 'FEMALE'} onClick={() => setChild({ ...child, gender: 'FEMALE' })}>{t('Girls')}</button>
        </div>
        <div><label className="gk-field__label" htmlFor={`${id}-dob`}>{t('Date of birth')}</label><input id={`${id}-dob`} className="gk-input" type="date" value={child.birthDate} max={new Date().toISOString().slice(0, 10)} style={{ maxWidth: 200 }} onChange={event => setChild({ ...child, birthDate: event.target.value })} /><span className="gk-field__hint">{t('Puts your child in the right age group.')}</span></div>
        <label className="gk-row" style={{ gap: 8, alignItems: 'flex-start' }}><input type="checkbox" checked={child.consent} onChange={event => setChild({ ...child, consent: event.target.checked })} style={{ marginTop: 3 }} /><span>{t('I am the parent or guardian. Only the coach sees this; nothing about my child is public.')}</span></label>
        {error && <p className="gk-notice gk-notice--warning" role="alert">{error}</p>}
        <div className="gk-boxedit__foot"><Button variant="primary" disabled={busy || !child.first.trim() || !child.birthDate || !child.consent} onClick={() => void submit()}>{busy ? <Loader2 className="gk-spin" aria-hidden="true" /> : null}{t('Add my child')}</Button></div>
      </div>
    </Panel>;
  return <GkRoot className="gk-page gk-join"><PageFrame width="profile"><Section title={t('Join {name}', { name: link?.page.name ?? '' })} hint={link ? t('{squad} · {town}', { squad: link.squad.name, town: link.page.town }) : undefined}>{body}</Section></PageFrame></GkRoot>;
}
