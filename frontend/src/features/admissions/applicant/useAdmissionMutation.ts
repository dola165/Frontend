import { useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { useAuth } from '../../../context/AuthContext';
import { getAuthSessionId, isCurrentAuthSession } from '../../../utils/authStorage';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { clearReceipt, installAdmissionPrivacyCleanup, prepareReceipt, readReceipt, receiptKey, type PendingReceipt } from './receipt';
installAdmissionPrivacyCleanup(getAuthSessionId);

export function useAdmissionMutation<T extends object,R>(subject:number, operation:string, send:(body:T&{requestId:string})=>Promise<R>, success:(result:R)=>void, refresh?:()=>void) {
    const {user,sessionId}=useAuth();
    const copy=useJourneyCopy();
    const key=receiptKey(`${user?.id}:${sessionId}`,subject,operation);
    const [pending,setPending]=useState<PendingReceipt<T>|null>(()=>readReceipt<T>(key));
    const [busy,setBusy]=useState(false);
    const [error,setError]=useState('');
    const lock=useRef(false);
    const mounted=useRef(true);
    useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
    async function run(payload:T) {
        if(lock.current)return;
        lock.current=true;setBusy(true);setError('');
        try {
            const receipt=prepareReceipt(key,payload);setPending(receipt);
            const result=await send({...receipt.payload,requestId:receipt.requestId});
            if(!isCurrentAuthSession(sessionId))return;
            clearReceipt(key);
            if(!mounted.current)return;
            setPending(null);success(result);
        } catch(e) {
            if(!isCurrentAuthSession(sessionId)||!mounted.current)return;
            const code=isAxiosError(e)?e.response?.data?.code:undefined;
            const messages:Record<string,string>={
                STALE_VERSION:copy('The arrangement changed. Refresh and review the new details before confirming.','პირობები შეიცვალა. განაახლეთ და დადასტურებამდე განიხილეთ ახალი დეტალები.'),
                CAPACITY_FULL:copy('The last place has just been taken. Refresh availability and choose the waiting list if offered.','ბოლო ადგილი შეივსო. განაახლეთ ხელმისაწვდომობა და აირჩიეთ მოლოდინის სია, თუ არსებობს.'),
                GUARDIAN_REQUIRED:copy('A currently authorized guardian must make this commitment. Review Family connections.','ეს გადაწყვეტილება მოქმედმა მეურვემ უნდა დაადასტუროს. იხილეთ ოჯახური კავშირები.'),
                GUARDIAN_REVIEW:copy('Guardian authority needs review. Contact the responsible club staff before confirming.','მეურვის უფლებამოსილება განხილვას საჭიროებს. დადასტურებამდე დაუკავშირდით კლუბის პასუხისმგებელ პირს.'),
                DEADLINE_PASSED:copy('The response deadline passed. Ask the club for the next arrangement.','პასუხის ვადა გავიდა. სთხოვეთ კლუბს ახალი შეთანხმება.'),
                TERMS_INCOMPLETE:copy('Essential terms are missing. The club must complete them before enrollment.','მნიშვნელოვანი პირობები აკლია. ჩარიცხვამდე კლუბმა უნდა შეავსოს ისინი.'),
            };
            setError(e instanceof Error && e.message==='PENDING_RETRY'?copy('Retry the saved request first; its outcome is still unconfirmed.','ჯერ გაიმეორეთ შენახული მოთხოვნა; შედეგი დაუდასტურებელია.'):messages[code]||extractApiErrorMessage(e,copy('The result could not be confirmed. Retry the saved request with the same details.','შედეგი ვერ დადასტურდა. გაიმეორეთ შენახული მოთხოვნა იგივე მონაცემებით.')));
            if(isAxiosError(e)&&e.response&&[400,403,404,409].includes(e.response.status)) {clearReceipt(key);setPending(null);refresh?.();}
        } finally {lock.current=false;if(mounted.current)setBusy(false);}
    }
    return {busy,pending,error,run,retry:()=>pending&&run(pending.payload)};
}
