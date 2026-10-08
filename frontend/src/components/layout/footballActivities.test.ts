import { expect, it } from 'vitest';
import { activityForDestination, footballActivities } from './footballActivities';
import type { NavigationCapabilities } from '../../context/navigationCapabilities';

const capabilities: NavigationCapabilities = { version: 1, workspaces: [
  { id: 'club.workspace', context: { id: 1, type: 'club', label: 'Dinamo' } },
  { id: 'club.workspace', context: { id: 121, type: 'club', label: 'Second club' } },
  { id: 'parent.hub', context: { id: 7, type: 'user', label: 'Parent Hub' } },
  { id: 'venue.workspace', context: { id: 133, type: 'organization', label: 'Sports Park' } },
  { id: 'agent.hub', context: { id: 7, type: 'user', label: 'Agent Hub' } },
] };
it('uses destination context without hiding other approved responsibilities', () => {
  const activities = footballActivities(capabilities);
  expect(activityForDestination(activities, '/parent', '', capabilities)?.id).toBe('parent-hub');
  expect(activityForDestination(activities, '/clubs/121/workspace', '', capabilities)?.id).toBe('my-club');
  expect(activityForDestination(activities, '/my-organizations', '?kind=VENUE', capabilities)?.id).toBe('my-venues');
  expect(activityForDestination(activities, '/agent', '', capabilities)?.id).toBe('agent-hub');
  expect(activities.map(a => a.id)).toEqual(['my-club', 'parent-hub', 'agent-hub', 'my-venues']);
});
it('does not invent responsibilities for a fresh account or browsing visitor', () => {
  const fresh = { version: 1 as const, workspaces: [] };
  const activities = footballActivities(fresh);
  expect(activities.map(a => a.id)).toEqual(['clubs-following']);
  expect(activityForDestination(activities, '/parent', '', fresh)).toBeUndefined();
  expect(activityForDestination(footballActivities(capabilities), '/clubs/999', '', capabilities)).toBeUndefined();
});
