import {expect,it} from 'vitest';
import {clubToday,appointmentStatus,type Appointment} from './api';
it('uses the club calendar on both sides of midnight, including daylight saving',()=>{
 const now=new Date('2026-09-28T23:00:00Z');
 expect(clubToday('Asia/Tbilisi',now)).toBe('2026-09-29');
 expect(clubToday('America/Los_Angeles',now)).toBe('2026-09-28');
 expect(clubToday('America/Los_Angeles',new Date('2026-03-08T10:30:00Z'))).toBe('2026-03-08');
});
it('uses the authoritative server outcome when an accepted appointment is future dated',()=>{
 expect(appointmentStatus({status:'ACTIVE',effective_status:'UPCOMING',starts_on:'2026-09-29'} as Appointment)).toBe('Upcoming');
});
