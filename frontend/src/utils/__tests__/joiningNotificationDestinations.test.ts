import { describe, expect, it, vi } from 'vitest';
import { safeNotificationLink } from '../notificationDestinations';
import { buildNotificationDestination, notificationActionLabel, formatNotificationTime } from '../notifications';
import type { NotificationItem } from '../../types/notifications';
const note=(entityType:string,linkPath:string|null):NotificationItem=>({id:7,type:'ADMISSION_UPDATED',scope:'PERSONAL',clubId:null,clubName:null,entityType,entityId:42,title:'Synthetic joining update',body:'',isRead:false,createdAt:'2026-10-04T10:00:00Z',linkPath});
describe('Joining notification continuation',()=>{
    it.each([['admission_case','/admissions/cases/42'],['admission_inquiry','/admissions/inquiries/42']])('opens the exact authorized %s record', (kind,path)=>{expect(buildNotificationDestination(note(kind,path))).toBe(path);});
    it.each([['admission_case','caseId'],['admission_inquiry','inquiryId']])('opens the matching club intake record for %s', (kind,key)=>{const path=`/clubs/1/workspace?tab=admissions&${key}=42`;expect(buildNotificationDestination(note(kind,path))).toBe(path);});
    it.each([['admission_case','/admissions/cases/43'],['admission_inquiry','/admissions/inquiries/43'],['admission_inquiry','/clubs/1/workspace?tab=admissions&inquiryId=43'],['admission_case','/clubs/1/workspace?tab=players&caseId=42']])('retains the receipt for mismatched %s destinations', (kind,path)=>{expect(buildNotificationDestination(note(kind,path))).toBe('/notifications?itemId=7');});
    it('checks the notified club against the intake link',()=>{expect(buildNotificationDestination({...note('admission_case','/clubs/2/workspace?tab=admissions&caseId=42'),clubId:1})).toBe('/notifications?itemId=7');});
    it('keeps a family/player review on the selected identity',()=>{expect(buildNotificationDestination(note('admission_governance','/parent'))).toBe('/parent?player=42');});
    it('opens a preserved offline invitation on the applicant landing page',()=>{expect(buildNotificationDestination({...note('admission_invitation','/admissions'),type:'ADMISSION_INVITATION'})).toBe('/admissions');});
    it.each(['/admissions/cases/0','/admissions/inquiries/01','/admissions/cases/9007199254740992','/admissions?player=42&player=43','/account?inquiryId=42','/clubs/1/workspace?tab=admissions&caseId=42&inquiryId=42','/admissions/cases/42?caseId=42'])('rejects malformed or misplaced context %s',path=>{expect(safeNotificationLink(path)).toBeNull();});
    it('uses a useful action label for a visit or offer update',()=>{expect(notificationActionLabel(note('admission_case','/admissions/cases/42'))).toBe('View next step');});
});

it('opens the existing enquiry conversation without mistaking its id for the enquiry id',()=>{
 expect(buildNotificationDestination(note('admission_inquiry','/messages?conversationId=8'))).toBe('/messages?conversationId=8');
});
it.each(['/messages?conversationId=0','/messages?conversationId=8&clubId=1','/messages?conversationId=8#other','https://untrusted.example/messages?conversationId=8'])('rejects an invalid or unrelated enquiry chat destination %s',path=>{
 expect(buildNotificationDestination(note('admission_inquiry',path))).toBe('/notifications?itemId=7');
});

it('treats offset-free notification timestamps as UTC while preserving explicit offsets',()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-05T04:00:00Z'));
 try{expect(formatNotificationTime('2026-10-05T04:00:00')).toBe(formatNotificationTime('2026-10-05T04:00:00Z'));expect(formatNotificationTime('2026-10-05T08:00:00+04:00')).toBe(formatNotificationTime('2026-10-05T04:00:00Z'));}finally{vi.useRealTimers();}
});
