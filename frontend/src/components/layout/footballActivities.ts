import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { NavigationCapabilities } from '../../context/navigationCapabilities';
export type FootballActivity = { id: string; path: string; label: string; translationKey: string };
export function footballActivities(caps?: NavigationCapabilities): FootballActivity[] {
  const ws = caps?.workspaces ?? [];
  const result: FootballActivity[] = [];
  const add = (id: string, path: string, label: string) => result.push({ id, path, label, translationKey: `activity.${id}` });
  const clubs = [...new Set(ws.filter(w => ['club.workspace', 'club.player'].includes(w.id)).map(w => w.context.id))];
  if (clubs.length) add('my-club', '/my-club', clubs.length > 1 ? 'My Clubs' : 'My Club');
  if (ws.some(w => w.id === 'parent.hub')) add('parent-hub', '/parent', 'Parent Hub');
  if (ws.some(w => w.id === 'referee.workspace')) add('referees', '/referees/me', 'Officiating');
  if (ws.some(w => w.id === 'agent.hub')) add('agent-hub', '/agent', 'Agent Hub');
  if (ws.some(w => w.id === 'venue.workspace')) add('my-venues', '/my-organizations?kind=VENUE', 'My Venues');
  if (ws.some(w => w.id === 'organization.workspace' && !ws.some(v => v.id === 'venue.workspace' && v.context.id === w.context.id))) add('my-organizations', '/my-organizations', 'My Organizations');
  if (ws.some(w => w.id === 'tournament.workspace')) add('my-tournaments', '/tournaments', 'Tournaments');
  if (!result.length) add('clubs-following', '/clubs/following', 'Following');
  return result;
}

export function useFootballActivity(userId?: number, caps?: NavigationCapabilities) {
  const activities = footballActivities(caps);
  const key = `gk:football-activity:${userId ?? 'guest'}`;
  const [choice, setChoice] = useState<{ key: string; id: string }>(() => {
    try { return { key, id: localStorage.getItem(key) ?? '' }; } catch { return { key, id: '' }; }
  });
  const selected = activities.find(a => a.id === (choice.key === key ? choice.id : '')) ?? activities[0];
  const navigate = useNavigate();
  const choose = (id: string) => {
    const item = activities.find(a => a.id === id); if (!item) return;
    setChoice({ key, id }); try { localStorage.setItem(key, id); } catch { /* Navigation remains usable without storage. */ }
    navigate(item.path);
  };
  return { activities, selected, choose };
}

