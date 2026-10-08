import { useState } from 'react';
import { createAdmissionInvitation } from '../api';
import type { AdmissionInvitation, AdmissionWorkspace, Choice, OfflineInvitationInput } from '../types';
import type { AuthSessionId } from '../../../utils/authStorage';
import { useDurableMutation } from './useDurableMutation';
import { useClubAdmissionCopy } from './copy';
import { AdmissionDate, AdmissionError, AdmissionField, AdmissionPanel } from './ui';

export function OfflineInquiry({workspace,people,sessionId,onClose}:{workspace:AdmissionWorkspace;people:Choice[];sessionId:AuthSessionId;onClose:()=>void}) {
  const {c,locale}=useClubAdmissionCopy();const [groupId,setGroupId]=useState(0),[email,setEmail]=useState(''),[player,setPlayer]=useState(''),[message,setMessage]=useState(''),[receipt,setReceipt]=useState<AdmissionInvitation|null>(null);
  const mutation=useDurableMutation(`inquiry:${sessionId}:${workspace.organizationId}`);
  const operation=(body:OfflineInvitationInput)=>createAdmissionInvitation(workspace.organizationId,body,sessionId);
  return <AdmissionPanel title={c('offlineInvite')} subtitle={c('offlineHint')}>
    {mutation.error&&<AdmissionError message={mutation.error} retry={c('retry')}/>}
    {receipt?<div className="admission-success" role="status"><strong>{c('offlineSent')} · {receipt.groupName}</strong><p className="admission-group-meta">{c('offlineNoCommitment')}</p><AdmissionDate value={receipt.expiresAt} locale={locale} label={c('responseDeadline')}/><button className="admission-secondary" onClick={onClose}>{c('back')}</button></div>:<>
    {mutation.pending&&<p className="admission-notice">{c('uncertain')} <button className="admission-text-button" disabled={mutation.busy} onClick={()=>void mutation.recover<AdmissionInvitation,OfflineInvitationInput>(operation).then(result=>{if(result)setReceipt(result);})}>{c('retry')}</button></p>}
    <form onSubmit={e=>{e.preventDefault();void mutation.send<AdmissionInvitation,OfflineInvitationInput>({groupId,recipientEmail:email.trim(),intendedPlayerId:player?Number(player):null,message},operation).then(result=>{if(result)setReceipt(result);});}}>
      <fieldset className="admission-form-grid" disabled={mutation.busy||Boolean(mutation.pending)}>
        <AdmissionField label={c('group')}><select required value={groupId} onChange={e=>setGroupId(Number(e.target.value))}><option value={0}>Choose the agreed group</option>{workspace.groups.filter(g=>workspace.canConfigure||g.canManage).map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></AdmissionField>
        <AdmissionField label={c('recipientEmail')} hint={c('verifiedContactHint')}><input type="email" required value={email} maxLength={254} onChange={e=>setEmail(e.target.value)}/></AdmissionField>
        <AdmissionField label={c('existingCard')} hint={c('existingCardHint')} wide><select value={player} onChange={e=>setPlayer(e.target.value)}><option value="">{c('recipientChooses')}</option>{people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></AdmissionField>
        <AdmissionField label={c('message')} hint={c('messageHint')} wide><textarea required value={message} maxLength={2000} onChange={e=>setMessage(e.target.value)}/></AdmissionField>
      </fieldset>
      <div className="admission-actions"><button className="admission-button" disabled={mutation.busy||Boolean(mutation.pending)||!groupId}>{c('sendInquiryInvitation')}</button><button type="button" className="admission-secondary" disabled={mutation.busy} onClick={onClose}>{c('cancel')}</button></div>
    </form></>}
  </AdmissionPanel>;
}
