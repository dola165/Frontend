import { accessibleClubs } from './clubAccess';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { NavigationCapabilities } from '../../context/navigationCapabilities';
import { resolveNavigationKey } from './navigation';
export type FootballActivity = { id: string; path: string; label: string; translationKey: string };
export function footballActivities(caps?: NavigationCapabilities): FootballActivity[] {
  const ws = caps?.workspaces ?? [];
  const result: FootballActivity[] = [];
  const add = (id: string, path: string, label: string, key: string) => result.push({ id, path, label, translationKey: `experience.navigation.${key}` });
  const clubs = accessibleClubs(caps);
  if (clubs.length) add('my-club', '/my-club', clubs.length > 1 ? 'My Clubs' : 'My Club', clubs.length > 1 ? 'myClubs' : 'myClub');
  if (ws.some(w => w.id === 'parent.hub' || w.id === 'club.family')) add('parent-hub', '/parent', 'Parent Hub', 'parent');
  if (ws.some(w => w.id === 'referee.workspace')) add('referees', '/referees/me', 'Officiating', 'referee');
  if (ws.some(w => w.id === 'agent.hub')) add('agent-hub', '/agent', 'Agent Hub', 'agent');
  if (ws.some(w => w.id === 'venue.workspace')) add('my-venues', '/my-organizations?kind=VENUE', 'My Venues', 'venues');
  if (ws.some(w => w.id === 'organization.workspace' && !ws.some(v => v.id === 'venue.workspace' && v.context.id === w.context.id))) add('my-organizations', '/my-organizations', 'My Organizations', 'organizations');

  if (!result.length) add('clubs-following', '/clubs/following', 'Following', 'following');
  return result;
}

export function activityForDestination(activities: FootballActivity[], pathname: string, search: string, caps?: NavigationCapabilities) {
  const clubIds = accessibleClubs(caps).map(w => w.id);
  const venueIds = caps?.workspaces.filter(w => w.id === 'venue.workspace').map(w => w.context.id);
  const active = resolveNavigationKey(pathname, null, { search, clubIds, venueIds });
  return activities.find(a => a.id === active);
}

export function useFootballActivity(userId?: number, caps?: NavigationCapabilities) {
  const activities = footballActivities(caps);
  const key = `gk:football-activity:${userId ?? 'guest'}`;
  const [choice, setChoice] = useState<{ key: string; id: string }>(() => {
    try { return { key, id: localStorage.getItem(key) ?? '' }; } catch { return { key, id: '' }; }
  });
  const location = useLocation();
  const preferred = choice.key === key ? choice.id : '';
  const selected = activityForDestination(activities, location.pathname, location.search, caps)
    ?? activities.find(a => a.id === preferred || (preferred === 'my-tournaments' && a.id === 'tournaments')) ?? activities[0];
  const navigate = useNavigate();
  const choose = (id: string) => {
    const item = activities.find(a => a.id === id); if (!item) return;
    setChoice({ key, id }); try { localStorage.setItem(key, id); } catch { /* Navigation remains usable without storage. */ }
    navigate(item.path);
  };
  return { activities, selected, choose };
}
