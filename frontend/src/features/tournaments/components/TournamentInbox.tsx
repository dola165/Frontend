import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Inbox, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { fetchMyTournamentInvitations } from '../api';
import type { TournamentInvitationInboxItem } from '../domain';
import { PaginationBar } from '../../../components/ui/PaginationBar';
import { extractApiErrorMessage } from '../../../utils/apiError';

export function TournamentInbox() {
    const { i18n }=useTranslation();const copy=(en:string,ka:string)=>i18n.language.startsWith('ka')?ka:en;
    const [data,setData]=useState<TournamentInvitationInboxItem[]>([]),[page,setPage]=useState(0),[total,setTotal]=useState(0),[pages,setPages]=useState(1),[size,setSize]=useState(12),[savedError,setError]=useState(''),[settledKey,setSettledKey]=useState(''),[attempt,setAttempt]=useState(0);
    const requestKey=JSON.stringify([page,size,attempt,i18n.language]),loading=requestKey!==settledKey,error=loading?'':savedError;
    const loadFailure=copy('Could not load tournament invitations.','ტურნირის მოწვევები ვერ ჩაიტვირთა.');
    useEffect(()=>{let active=true;fetchMyTournamentInvitations(page,size).then(result=>{if(active){setError('');setData(result.content);setTotal(result.totalElements);setPages(result.totalPages);}}).catch(err=>{if(active){setData([]);setError(extractApiErrorMessage(err,loadFailure));}}).finally(()=>{if(active)setSettledKey(requestKey);});return()=>{active=false;};},[page,size,attempt,i18n.language,requestKey,loadFailure]);
    return <section className="tc-stack" aria-label={copy('Tournament invitations','ტურნირის მოწვევები')}><div className="tw-toolbar"><div><h2>{copy('Invitations','მოწვევები')}</h2><p>{copy('Review the named club, squad or player before responding in Requests.','პასუხამდე მოთხოვნებში გადაამოწმეთ მოწვეული კლუბი, გუნდი ან მოთამაშე.')}</p></div><Link className="tw-button" to="/requests">{copy('Open Requests','მოთხოვნების გახსნა')} <ArrowRight size={16}/></Link></div>
        {error?<p role="alert" className="tw-error">{error} <button onClick={()=>setAttempt(a=>a+1)}>{copy('Retry','ხელახლა')}</button></p>:loading?<p role="status">{copy('Loading invitations…','მოწვევები იტვირთება…')}</p>:data.length?<><div className="tc-panel">{data.map(item=><article className="tc-invitation" key={item.invitationId}><Inbox size={21}/><div><h3>{item.tournamentName}</h3><p>{item.squadName || item.clubName || copy('Individual player invitation','მოთამაშის პირადი მოწვევა')}</p><small>{item.tournamentStatus === 'PLANNING'?copy('In preparation','მზადდება'):copy('Competition already started or ended','შეჯიბრება დაწყებულია ან დასრულებულია')}</small></div><Link className="tw-button" to="/requests">{copy('Review in Requests','მოთხოვნებში განხილვა')} <ArrowRight size={14}/></Link></article>)}</div><PaginationBar page={page} totalPages={pages} totalElements={total} pageSize={size} onPageChange={setPage} onPageSizeChange={value=>{setSize(value);setPage(0);}}/></>:<div className="tc-empty"><Inbox size={30}/><h3>{copy('No pending tournament invitations','ტურნირის მოლოდინის მოწვევები არ არის')}</h3><p>{copy('Invitations for you and clubs you manage will appear here.','თქვენი და თქვენს მიერ მართული კლუბების მოწვევები აქ გამოჩნდება.')}</p></div>}
    </section>;
}
