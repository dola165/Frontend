import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { reportAdmissionGuardianReview } from '../api';
import type { Participant, GuardianReviewInput } from '../types';
import { useAdmissionMutation } from './useAdmissionMutation';
import { useAdmissionCopy } from './copy';
import { AdmissionError } from './AdmissionFrame';
import { GuardianReviewStatus } from '../governance/FamilyGovernance';
import { PlayerIdentityEditor } from '../../players/PlayerIdentityEditor';

export function PlayerCardEditor({playerId,participant,onChanged}:{playerId:number;participant?:Participant;onChanged:()=>void;initialName?:string}) {
    const {copy}=useAdmissionCopy();
    return <details className="admission-panel" open={!participant}><summary>{participant?copy(`Edit ${participant.name}’s reusable card`,`მოთამაშის ბარათის რედაქტირება: ${participant.name}`):copy('Create my player card','ჩემი მოთამაშის ბარათის შექმნა')}</summary>
        <PlayerIdentityEditor playerId={playerId} onSaved={onChanged}/>
        {participant?.minor&&participant.guardian&&<><GuardianReviewStatus playerId={playerId}/><GuardianReviewForm playerId={playerId} onChanged={onChanged}/></>}
    </details>;
}
function GuardianReviewForm({playerId,onChanged}:{playerId:number;onChanged:()=>void}) {
    const {sessionId}=useAuth();const {copy}=useAdmissionCopy();const [reason,setReason]=useState('');const [saved,setSaved]=useState(false);
    const mutation=useAdmissionMutation<Omit<GuardianReviewInput,'requestId'>,void>(playerId,'guardian-review',body=>reportAdmissionGuardianReview(playerId,body,sessionId),()=>{setSaved(true);onChanged();});
    return <details><summary>{copy('Report a guardian restriction or dispute','მეურვის შეზღუდვის ან დავის შეტყობინება')}</summary><form className="admission-stack" onSubmit={e=>{e.preventDefault();void mutation.run({reason:reason.trim()});}}><p className="admission-muted">{copy('This pauses new commitments for review. It does not replace the responsible club contact for imminent attendance or collection arrangements.','ეს ახალი ვალდებულებების მიღებას აჩერებს განხილვამდე. მოახლოებული დასწრებისა თუ ბავშვის წამოყვანისთვის დაუკავშირდით კლუბის პასუხისმგებელ პირს.')}</p><label>{copy('Reason for review','განხილვის მიზეზი')}<textarea required maxLength={2000} value={reason} disabled={Boolean(mutation.pending)} onChange={e=>setReason(e.target.value)}/></label>{mutation.error&&<AdmissionError message={mutation.error}/>} {saved&&<p role="status">{copy('Review requested. New commitments are paused.','განხილვა მოთხოვნილია. ახალი ვალდებულებები შეჩერებულია.')}</p>}<button type={mutation.pending?'button':'submit'} className="admission-button" disabled={mutation.busy||(!mutation.pending&&!reason.trim())} onClick={mutation.pending?()=>void mutation.retry():undefined}>{mutation.pending?copy('Retry saved request','შენახული მოთხოვნის გამეორება'):copy('Request guardian review','მეურვის განხილვის მოთხოვნა')}</button></form></details>;
}
