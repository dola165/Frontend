import { expect, it } from 'vitest';
import { activityFromLinks } from './applyActivity';

const caps = (...ids: string[]) => ({ version: 1 as const, workspaces: ids.map(id => ({ id, context: { type: id.startsWith('club') ? 'club' : id.startsWith('squad') ? 'squad' : 'user', id: 7, label: 'x' } })) });

it('reads what a person does from confirmed links only', () => {
    expect(activityFromLinks(caps('squad.workspace'))).toBe('COACH');
    expect(activityFromLinks(caps('club.workspace'))).toBe('COACH');
    expect(activityFromLinks(caps('parent.hub'))).toBe('PARENT');
    expect(activityFromLinks(caps('club.family'))).toBe('PARENT');
    expect(activityFromLinks(caps('club.player'))).toBe('PLAY');
    // Coaching a squad and having a child: the coach's start, Parent Hub stays a tab either way.
    expect(activityFromLinks(caps('parent.hub', 'squad.workspace'))).toBe('COACH');
    expect(activityFromLinks(caps())).toBeNull();
    expect(activityFromLinks(undefined)).toBeNull();
    expect(activityFromLinks(caps('referee.workspace'))).toBeNull();
});
