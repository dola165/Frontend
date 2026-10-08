import { CheckCircle2, Clock3, Route } from 'lucide-react';
import type { Match } from '../matchExchange/api';
import { useClock } from '../matchExchange/hooks';
import { JourneyLauncher } from './JourneyLauncher';
import './journey-schedule.css';

/** Durable fixture state survives the invitation panel disappearing after acceptance. */
export function ChallengeJourneyProgress({match}:{match:Match}) {
 const now=useClock();
 const cancelled=match.event_status==='CANCELLED',finished=match.event_status==='COMPLETED'||Date.parse(match.ends_at_iso)<=now;
 const agreed=match.listing_status==='ARRANGED'&&Boolean(match.opponent_name),closed=match.listing_status==='CLOSED';
 const title=cancelled?'Match cancelled':finished?'Match finished':agreed?'Challenge accepted':closed?'Challenge closed':match.requested_club_id?'Awaiting the invited club':'Find your next opponent';
 const detail=cancelled?'The match is cancelled. Review any connected journey before making new arrangements.':finished?'Review the result and the shared journey record.':agreed?`${match.club_name} and ${match.opponent_name} are agreed. Review the ground and officials, then plan gathering, travel and return.`:closed?'Review the current match details before making a new proposal.':'You can prepare a private journey now. Families receive it only after the fixture is agreed and you publish the reviewed plan.';
 const Icon=agreed?CheckCircle2:cancelled||closed?Route:Clock3;
 return <section className="challenge-journey-progress" aria-label="Challenge and journey progress"><Icon size={23}/><div><h2>{title}</h2><p>{detail}</p></div>{!cancelled&&!finished&&!closed&&match.can_arrange&&<JourneyLauncher eventId={match.event_id}/>}</section>;
}
