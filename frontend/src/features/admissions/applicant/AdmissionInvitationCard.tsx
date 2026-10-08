import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { claimAdmissionInvitation } from '../api';
import type { AdmissionCase, AdmissionInvitation, ClaimInvitationInput, Participant } from '../types';
import { useAdmissionMutation } from './useAdmissionMutation';
import { useAdmissionCopy } from './copy';
import { AdmissionError } from './AdmissionFrame';
import { readReceipt, receiptKey } from './receipt';
export function AdmissionInvitationCard({invitation:i,participants,onChanged}:{invitation:AdmissionInvitation;participants:Participant[];onChanged:()=>void}) {
    const {sessionId,user}=useAuth();const {copy}=useAdmissionCopy();
    const [selected,setSelected]=useState(()=>participants.find(p=>readReceipt(receiptKey(`${user?.id}:${sessionId}`,p.id,`invitation:${i.id}`)))?.id||(i.intendedPlayerId&&participants.some(p=>p.id===i.intendedPlayerId)?i.intendedPlayerId:0));
    return <article className="admission-panel"><p className="admission-eyebrow">{copy('Invitation after an offline conversation','მოწვევა პირადი საუბრის შემდეგ')}</p><h2>{i.groupName}</h2><p>{i.organizationName}</p><p>{i.message}</p><p>{copy('Expires','ვადა')}: {new Date(i.expiresAt).toLocaleString()}</p><p>{copy('This invitation is bound to your verified account. It gives no guardian authority or enrollment. Link an existing child through Family connections before selecting their card.','მოწვევა თქვენს დადასტურებულ ანგარიშს ეკუთვნის. მეურვის უფლებამოსილებას ან ჩარიცხვას არ იძლევა. ბავშვის ბარათის ასარჩევად ჯერ დააკავშირეთ იგი ოჯახურ კავშირებში.')}</p>{i.status==='PENDING'&&<><div className="admission-field"><label htmlFor={`admission-invitation-player-${i.id}`}> {copy('Existing authorized player card','არსებული უფლებამოსილი მოთამაშის ბარათი')}</label><select id={`admission-invitation-player-${i.id}`} value={participants.some(p=>p.id===selected)?selected:''} onChange={e=>setSelected(Number(e.target.value))}><option value="">{copy('Choose a player','აირჩიეთ მოთამაშე')}</option>{participants.filter(p=>!i.intendedPlayerId||p.id===i.intendedPlayerId).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div><InvitationResponse key={selected||user?.id} invitation={i} selected={selected} participants={participants} onChanged={onChanged}/></>}<Link className="admission-button" to="/parent">{copy('Review secure family invitations','უსაფრთხო ოჯახური მოწვევების განხილვა')}</Link></article>;
}
function InvitationResponse({invitation:i,selected,participants,onChanged}:{invitation:AdmissionInvitation;selected:number;participants:Participant[];onChanged:()=>void}) {
    const {sessionId,user}=useAuth();const {copy}=useAdmissionCopy();const navigate=useNavigate();const [agree,setAgree]=useState(false);
    const mutation=useAdmissionMutation<Omit<ClaimInvitationInput,'requestId'>,AdmissionCase|null>(selected||user!.id,`invitation:${i.id}`,body=>claimAdmissionInvitation(i.id,body,sessionId),result=>{onChanged();if(result)navigate(`/admissions/cases/${result.id}`);},onChanged);
    const current=participants.some(p=>p.id===selected);
    return <><label className="admission-check"><input type="checkbox" checked={agree} disabled={Boolean(mutation.pending)} onChange={e=>setAgree(e.target.checked)}/>{copy('I confirm the named player and want to continue this recorded inquiry.','ვადასტურებ დასახელებულ მოთამაშეს და მსურს ამ დაფიქსირებული მოთხოვნის გაგრძელება.')}</label>
            <div className="admission-actions">{mutation.pending?<button className="admission-button" disabled={mutation.busy} onClick={()=>void mutation.retry()}>{copy('Retry saved response','შენახული პასუხის გამეორება')}</button>:<><button className="admission-button admission-primary" disabled={mutation.busy||!agree||!current} onClick={()=>void mutation.run({expectedVersion:i.version,playerId:selected,accept:true})}>{copy('Continue this inquiry','მოთხოვნის გაგრძელება')}</button><button className="admission-button" disabled={mutation.busy} onClick={()=>void mutation.run({expectedVersion:i.version,playerId:selected||user!.id,accept:false})}>{copy('Decline invitation','მოწვევის უარყოფა')}</button></>}</div>
        {mutation.error&&<AdmissionError message={mutation.error}/>}</>;
}
