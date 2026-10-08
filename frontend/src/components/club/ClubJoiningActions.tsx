import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { fetchClubJoiningOptions } from '../../features/joining-contract/api';
import type { JoiningOption } from '../../features/joining-contract/types';
import type { ClubEnquiryContext } from '../../features/clubs/publicJourney';
import { playerPath, positivePlayerId } from '../../features/parents/playerSelection';

export function ClubJoiningActions({ clubId, context, onContact }: { clubId: number; context: ClubEnquiryContext; onContact: (context: ClubEnquiryContext) => void }) {
  const location=useLocation(), playerId=positivePlayerId(new URLSearchParams(location.search).get('player'));
  const [result, setResult] = useState<{ scope: string; options: JoiningOption[]; failed: boolean } | null>(null), [retry, setRetry] = useState(0);
  const scope = `${clubId}:${context.path}:${retry}`;
  useEffect(() => {
    const abort = new AbortController();
    const path = new URL(context.path, window.location.origin), programme = Number(path.searchParams.get('programme')), squad = Number(path.searchParams.get('squad'));
    void fetchClubJoiningOptions(clubId, abort.signal).then(data => {
      if (!abort.signal.aborted) setResult({ scope, failed: false, options: data.options.filter(option => squad ? option.squadId === squad : programme ? option.programmeIds.includes(programme) : option.squadId !== null && context.squadIds.includes(option.squadId)) });
    }).catch(() => { if (!abort.signal.aborted) setResult({ scope, failed: true, options: [] }); });
    return () => abort.abort();
  }, [clubId, context.path, context.squadIds, scope]);
  return <section className="cp-card cp-next-step"><span className="cp-eyebrow">Interested in training here?</span><h3>Come and meet the team</h3><button type="button" className="cp-button cp-button-primary cp-first-visit" onClick={()=>onContact({...context,intent:"visit"})}>Arrange a first visit<ArrowRight size={18}/></button><button type="button" className="cp-button" onClick={()=>onContact({...context,intent:"question"})}>Ask a question</button>
    {result?.scope !== scope ? <p role="status">Checking current joining options…</p> : result.failed ? <p>Joining options could not load. <button type="button" className="cp-text-button" onClick={() => setRetry(value => value + 1)}>Try again</button></p> : result.options.length ? <div className="cp-joining-options">{result.options.map(option => <div key={option.opportunity ? `group:${option.opportunity.id}` : `squad:${option.squadId}`}><strong>{option.squadName}</strong><p>{option.availability === 'CLOSED' ? 'Intake is currently closed.' : option.availability === 'WAITLIST' ? 'Waiting-list enquiries are available.' : option.availability === 'ENQUIRY_ONLY' ? 'Speak with the club to arrange the first step.' : `${option.opportunity?.remainingPlaces ?? ''} regular places available.`}</p>{option.destination && option.opportunity && option.availability !== 'CLOSED' && <Link className="cp-button cp-button-primary" to={playerPath(option.destination,playerId)}>{option.availability === 'WAITLIST' ? 'Review waiting-list request' : 'Review joining & request a place'}<ArrowRight size={16} /></Link>}</div>)}</div> : <p>Ask the club about availability and the right group. Staff will confirm the next step.</p>}
    <small>Choose your player, preferred venue and club contact. The reply comes straight to your chat.</small>
  </section>;
}

