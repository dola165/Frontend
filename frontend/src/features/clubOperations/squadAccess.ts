import type { Bootstrap } from './api';

/**
 * Whether this person may use one tool's records for one squad: the club has the tool switched on
 * and their access covers the squad. Used by Coach Hub, squads and the player panel alike; the server stays authoritative.
 */
export function canReadSquad(boot: Bootstrap | null, module: string, squad: number) {
  return Boolean(boot?.settings.enabled_modules.includes(module) && boot.modules.some(m => m.id === module && (m.globalRead || m.readSquads?.includes(squad))));
}
