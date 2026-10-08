import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, MessageSquare, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { isCurrentAuthSession } from '../../utils/authStorage';
import { buildLoginRedirectPath } from '../../utils/authRedirect';
import { fetchJoiningChildren, fetchClubJoiningOptions, submitClubEnquiry } from '../../features/joining-contract/api';
import type { ClubJoiningOptions, ConnectedInquiry, EnquiryInput } from '../../features/joining-contract/types';
import { fetchAdmissionHome } from '../../features/admissions/api';
import type { Choice } from '../../features/admissions/types';
import type { ClubEnquiryContext } from '../../features/clubs/publicJourney';
import { useDialogFocus } from '../workspace/useDialogFocus';
import { enquiryReasons, buildClubEnquiry, clubEnquiryIntro } from '../../features/clubs/enquiryMessage';
import { useClubPanelMotion } from '../../features/clubs/useClubPanelMotion';
import { positivePlayerId, readSelectedPlayer } from '../../features/parents/playerSelection';
import { fetchJoiningContext, contactLabel, type JoiningContext } from '../../features/joining-contract/conversation';
import { emitNotificationsChanged } from '../../utils/notifications';
import { useAdmissionMutation } from '../../features/admissions/applicant/useAdmissionMutation';

type ClubEnquiryModalProps = { clubId: number; clubName: string; context: ClubEnquiryContext; onClose: () => void };
export function ClubEnquiryModal(props: ClubEnquiryModalProps) {
  const { sessionId } = useAuth();
  return <ClubEnquiryForm key={`${sessionId}:${props.clubId}:${props.context.path}`} {...props} />;
}

function ClubEnquiryForm({ clubId, clubName, context, onClose }: ClubEnquiryModalProps) {
  const motion = useClubPanelMotion(onClose);
  const { status, sessionId, user } = useAuth();
  const navigate = useNavigate(), location = useLocation(), heading = useId();
  const requestedPlayer = new URLSearchParams(location.search).has('player') ? positivePlayerId(new URLSearchParams(location.search).get('player')) : readSelectedPlayer(user?.id,sessionId);
  const prefill = useRef('');
  const dialog = useRef<HTMLDivElement>(null);
  const [players, setPlayers] = useState<Choice[]>([]), [options, setOptions] = useState<ClubJoiningOptions | null>(null);
  const [loadedScope, setLoadedScope] = useState(''), [loadError, setLoadError] = useState(''), [retry, setRetry] = useState(0);
  const loadScope = `${sessionId}:${clubId}:${user?.id}:${retry}:${requestedPlayer}`;
  const loading = status === 'authenticated' && loadedScope !== loadScope;
  const [player, setPlayer] = useState(''), [group, setGroup] = useState(''), [body, setBody] = useState(''), [reason, setReason] = useState(context.intent === 'visit' ? 'Arrange a first visit' : 'Ask a question');
  const [error, setError] = useState(''), [sent, setSent] = useState<ConnectedInquiry | null>(null);
  const publicPath = new URL(context.path, window.location.origin);
  const programmeId = Number(publicPath.searchParams.get('programme')) || null;
  const squadId = Number(publicPath.searchParams.get('squad')) || null;
  const mutation = useAdmissionMutation<Omit<EnquiryInput, 'requestId'>, ConnectedInquiry>(clubId,
    `public-enquiry:${programmeId ?? ''}:${squadId ?? ''}`, payload => submitClubEnquiry(clubId, payload, sessionId), result => {setSent(result);if(result.conversationDestination)navigate(result.conversationDestination);});
  const busy = mutation.busy;
  const [joiningContext,setJoiningContext]=useState<JoiningContext|null>(null),[contact,setContact]=useState(''),[venue,setVenue]=useState('');
  const selectedOption=relevantOption();
  function relevantOption(){const choices=options?.options.filter(o=>squadId?o.squadId===squadId:programmeId?o.programmeIds.includes(programmeId):o.squadId!==null&&context.squadIds.includes(o.squadId))??[];return choices.find(o=>(o.opportunity?`group:${o.opportunity.id}`:`squad:${o.squadId}`)===group)??(choices.length===1?choices[0]:undefined);}
  const contactSquad=selectedOption?.squadId??squadId??(context.squadIds.length===1?context.squadIds[0]:null);
  useEffect(()=>{const abort=new AbortController();setJoiningContext(null);setContact('');setVenue('');if(status==='authenticated')void fetchJoiningContext(clubId,contactSquad,sessionId,abort.signal).then(value=>{if(!abort.signal.aborted&&isCurrentAuthSession(sessionId)){setJoiningContext(value);if(value.venues.length===1)setVenue(String(value.venues[0].id));}}).catch(()=>{});return()=>abort.abort();},[clubId,contactSquad,sessionId,status]);
  const requestClose = () => { if (!busy) motion.close(); };
  useDialogFocus(true, dialog, requestClose);
  const relevant = (loadedScope === loadScope ? options : null)?.options.filter(option => squadId ? option.squadId === squadId : programmeId ? option.programmeIds.includes(programmeId) : option.squadId !== null && context.squadIds.includes(option.squadId)) ?? [];
  const optionKey = (option: ClubJoiningOptions['options'][number]) => option.opportunity ? `group:${option.opportunity.id}` : `squad:${option.squadId}`;
  useEffect(() => {
    const abort = new AbortController();
    if (status !== 'authenticated') return () => abort.abort();
    void Promise.allSettled([fetchJoiningChildren(sessionId, abort.signal), fetchAdmissionHome(sessionId, abort.signal), fetchClubJoiningOptions(clubId, abort.signal)]).then(([children, home, joining]) => {
      if (abort.signal.aborted || !isCurrentAuthSession(sessionId)) return;
      setLoadError('');
      const choices: Choice[] = children.status === 'fulfilled' ? children.value.children.map(child => ({ id: child.playerId, name: child.identity.fullName })) : [];
      const self = home.status === 'fulfilled' ? home.value.participants.find(person => person.id === user?.id && !person.guardian) : undefined;
      if (self && !choices.some(person => person.id === self.id)) choices.push({ id: self.id, name: `${self.name} (myself)` });
      setPlayers(choices);
      const prefillScope=`${sessionId}:${clubId}:${requestedPlayer}`;
      if(prefill.current!==prefillScope){prefill.current=prefillScope;setPlayer(requestedPlayer&&choices.some(person=>person.id===requestedPlayer)?String(requestedPlayer):'');}
      if (joining.status === 'fulfilled') setOptions(joining.value);
      if (children.status === 'rejected') setLoadError('Your player choices could not load. You can still ask a general question.');
      else if (joining.status === 'rejected') setLoadError('Joining options could not load. Your enquiry will keep this programme or team as context.');
      else if(requestedPlayer&&!choices.some(person=>person.id===requestedPlayer))setLoadError('The selected player is unavailable with your current access. Choose another player or ask a general question.');
      setLoadedScope(loadScope);
    });
    return () => abort.abort();
  }, [clubId, sessionId, status, user?.id, retry, requestedPlayer, loadScope]);
  const chosenPlayer=players.find(person=>person.id===Number(player));
  const chosenVenue=joiningContext?.venues.find(place=>place.id===Number(venue));
  const enquiryDraft={reason,programme:context.name,club:clubName,path:context.path,player:chosenPlayer?.name.replace(/ \(myself\)$/,''),self:Number(player)===user?.id,contact:joiningContext?.contacts.find(person=>person.id===Number(contact))?.name,venue:chosenVenue?`${chosenVenue.name}${chosenVenue.address?` · ${chosenVenue.address}`:''}`:undefined,note:body};
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (motion.closing || busy || mutation.pending || status !== 'authenticated' || !isCurrentAuthSession(sessionId) || !(reason === 'Ask a question' || enquiryReasons.some(value => value === reason))) return;
    if (player && !players.some(person => person.id === Number(player))) { setError('Choose a currently authorized player, or ask a general question.'); return; }
    if (reason === 'Arrange a first visit' && !player) { setError('Select the player for this first visit. You can ask a general question without selecting anyone.'); return; }
    const selected = relevant.find(option => optionKey(option) === group) ?? (relevant.length === 1 ? relevant[0] : undefined);
    if(reason !== 'Arrange a first visit' && !body.trim()){setError('Write your question for the club.');return;}
    const payload = { contactId:contact?Number(contact):null,preferredFacilityId:venue?Number(venue):null,playerId: player ? Number(player) : null, programmeId, squadId: selected?.squadId ?? squadId, groupId: selected?.opportunity?.id ?? null, message: buildClubEnquiry(enquiryDraft) };
    if (payload.message.length > 2000) { setError('Shorten your question to 1900 characters.'); return; }
    setError('');
    await mutation.run(payload);
    emitNotificationsChanged();
  };
  const signIn = () => {
    const destination = new URL(context.path, window.location.origin); destination.searchParams.set('enquire', '1');
    if(requestedPlayer)destination.searchParams.set('player',String(requestedPlayer));
    navigate(buildLoginRedirectPath(destination.pathname, destination.search, destination.hash));
  };
  return <div className="cp-modal-backdrop club-motion-backdrop" data-closing={motion.closing} onClick={requestClose}><section className="club-public cp-enquiry club-motion-dialog" data-closing={motion.closing} onAnimationEnd={motion.onAnimationEnd} ref={dialog} role="dialog" aria-modal="true" aria-labelledby={heading} onClick={event => event.stopPropagation()}>
    <header className="cp-enquiry-heading"><div><span className="cp-section-icon" data-tone="blue"><MessageSquare size={21} /></span><h2 id={heading}>{sent ? 'Enquiry sent' : reason === 'Arrange a first visit' ? 'Arrange a first visit' : 'Ask the club'}</h2></div><button type="button" className="cp-icon-button" aria-label="Close enquiry" disabled={busy} onClick={requestClose}><X size={20} /></button></header>
    {sent ? <div className="cp-enquiry-body"><CheckCircle2 size={34} className="cp-success" /><h3>Your enquiry is with the club</h3><p>{sent.playerName ? `This enquiry is about ${sent.playerName}.` : 'This is a general question; no child details were shared.'} The conversation and next steps stay connected.</p><div className="cp-enquiry-links">{sent.conversationDestination && <Link className="cp-button cp-button-primary" to={sent.conversationDestination}>Open conversation<ArrowRight size={16} /></Link>}<Link className="cp-button" to={sent.applicantDestination}>View enquiry & next step<ArrowRight size={16} /></Link></div></div> : <form onSubmit={event => void submit(event)} className="cp-enquiry-body">
      <div className="cp-enquiry-context"><span className="cp-eyebrow">About this enquiry</span><strong>{context.name}</strong><span>{clubName}</span></div>
      {status !== 'authenticated' ? <><p>Sign in to ask the club and keep its reply in your inbox.</p><button type="button" className="cp-button cp-button-primary" onClick={signIn}>Sign in to enquire<ArrowRight size={16} /></button></> : <>
      {mutation.pending && <div className="cp-enquiry-context" role="status"><p>The outcome of your saved enquiry is unconfirmed. Recover it before sending another enquiry.</p><button type="button" className="cp-button" disabled={busy} onClick={() => void mutation.retry()}>{busy ? 'Checking saved enquiry…' : 'Retry saved enquiry'}</button></div>}
      {mutation.error && <p role="alert" className="cp-error">{mutation.error}</p>}
      <fieldset disabled={busy || Boolean(mutation.pending)} className="cp-enquiry-fields">
        <label>What would you like help with?<select aria-label="Enquiry reason" required value={reason} onChange={event => setReason(event.target.value)}><option value="Ask a question">Ask a question</option>{enquiryReasons.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label>Who is this about?<select aria-label="Enquiry player" value={player} onChange={event => setPlayer(event.target.value)} disabled={loading}><option value="">General question · no player selected</option>{players.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
        <p className="cp-muted">Select one player only for a player-specific enquiry. A general question shares no child identity.</p>
        {loading && <p role="status">Loading your players and joining options…</p>}
        {loadError && <p role="status">{loadError} <button type="button" className="cp-text-button" onClick={() => setRetry(value => value + 1)}>Retry choices</button></p>}
        {relevant.length > 1 && <label>Training group <span>(optional)</span><select value={group} onChange={event => setGroup(event.target.value)}><option value="">Ask about this programme</option>{relevant.map(option => <option key={optionKey(option)} value={optionKey(option)}>{option.squadName}{option.availability === 'CLOSED' ? ' · intake closed' : option.availability === 'WAITLIST' ? ' · waiting list' : ''}</option>)}</select></label>}
        {joiningContext&&<><label>Preferred training venue<select value={venue} onChange={event=>setVenue(event.target.value)}><option value="">Help me choose</option>{joiningContext.venues.map(place=><option key={place.id} value={place.id}>{place.name} · {place.address||'Confirm address with the club'}</option>)}</select></label><label>Who would you like to speak to?<select value={contact} onChange={event=>setContact(event.target.value)}><option value="">Club joining team</option>{joiningContext.contacts.map(person=><option key={person.id} value={person.id}>{contactLabel(person)}</option>)}</select></label><small>Online means connected now. A reply time is not guaranteed.</small></>}
        <div className="cp-enquiry-context"><strong>Message preview</strong><p>{clubEnquiryIntro(enquiryDraft)}</p></div>
        <label>{reason==='Arrange a first visit'?'Anything else? (optional)':'Your question'}<textarea required={reason!=='Arrange a first visit'} rows={3} maxLength={1900} placeholder="Ask about availability, training or arranging a first visit…" value={body} onChange={event => setBody(event.target.value)} /></label>
        <p className="cp-muted">The club’s authorized intake staff receive this enquiry. A visit or training place is agreed separately.</p>
        {error && <p role="alert" className="cp-error">{error}</p>}
        <button className="cp-button cp-button-primary" type="submit" disabled={!reason || (reason!=='Arrange a first visit'&&!body.trim()) || busy || loading || Boolean(mutation.pending)}>{busy ? 'Sending…' : reason==='Arrange a first visit'?'Request a first visit':'Send question'}<ArrowRight size={16} /></button>
      </fieldset></>}
    </form>}
  </section></div>;
}
