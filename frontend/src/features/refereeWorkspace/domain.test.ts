import { describe, expect, it } from 'vitest';
import type { Appointment } from '../matchExchange/api';
import { covers, refereeStage, workspaceSection } from './domain';

const now = Date.parse('2026-09-25T12:00:00Z');
const appointment = { status:'ACCEPTED', event_status:'SCHEDULED', starts_at_iso:'2026-09-24T09:00:00Z', ends_at_iso:'2026-09-24T11:00:00Z', report_submitted_at:null, inbox_section:'CURRENT' } as Appointment;
describe('referee work routing', () => {
  it('finds unfinished reports even while the scheduled fixture remains in the current inbox', () => expect(refereeStage(appointment,now)).toBe('follow-ups'));
  it('keeps submitted reports accessible in history even before the result closes the fixture', () => expect(refereeStage({...appointment,report_submitted_at:'2026-09-25T11:00:00Z'},now)).toBe('history'));
  it.each(['CANCELLED','WITHDRAWN','DECLINED'])('does not ask a %s official to finish a report',status => expect(refereeStage({...appointment,status},now)).toBe('history'));
  it('does not request a report for a cancelled fixture', () => expect(refereeStage({...appointment,event_status:'CANCELLED'},now)).toBe('history'));
  it('keeps a live assignment actionable until its end', () => expect(refereeStage({...appointment,ends_at_iso:'2026-09-25T13:00:00Z'},now)).toBe('upcoming'));
  it.each([['#appointment-15','assignments'],['#offer-22','opportunities'],['#history','assignments'],['#availability','availability'],['','overview']])('retains notification destination %s', (hash,section) => expect(workspaceSection(hash)).toBe(section));
  it('requires the entire match window, accounting for timezone offsets', () => {
    const windows=[{starts_at:'2026-10-04T10:00:00+04:00',ends_at:'2026-10-04T13:00:00+04:00'}];
    expect(covers(windows,'2026-10-04T07:00:00Z','2026-10-04T09:00:00Z')).toBe(true);
    expect(covers(windows,'2026-10-04T07:00:00Z','2026-10-04T10:00:00Z')).toBe(false);
  });
});
