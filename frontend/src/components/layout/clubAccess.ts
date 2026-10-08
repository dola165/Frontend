import type { NavigationCapabilities } from '../../context/navigationCapabilities';
export interface ClubAccess { id: number; name: string; canOpenWorkspace: boolean; relationships: string[] }
const relationships: Record<string,string> = {
  'club.workspace':'Club staff', 'club.operations':'Club staff', 'club.member':'Club appointment',
  'club.player':'Player', 'club.agent':'Agent engagement',
};
export function accessibleClubs(capabilities?: NavigationCapabilities): ClubAccess[] {
  const clubs = new Map<number, ClubAccess>();
  for (const entry of capabilities?.workspaces ?? []) {
    if (!Object.hasOwn(relationships,entry.id) || entry.context.type !== 'club' || !Number.isSafeInteger(entry.context.id) || entry.context.id <= 0) continue;
    const previous = clubs.get(entry.context.id);
    clubs.set(entry.context.id, { id: entry.context.id, name: entry.context.label,
      canOpenWorkspace: previous?.canOpenWorkspace === true || ['club.workspace','club.operations'].includes(entry.id),
      relationships:[...new Set([...(previous?.relationships??[]),relationships[entry.id]])] });
  }
  return [...clubs.values()].sort((a, b) => a.name.localeCompare(b.name));
}
