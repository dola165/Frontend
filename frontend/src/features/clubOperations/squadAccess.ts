import type { Bootstrap } from './api';

/** Whether this person may read one tool's records for one squad. The server stays authoritative. */
export function canReadSquad(boot: Bootstrap | null, module: string, squad: number) {
  return Boolean(boot?.modules.some(m => m.id === module && (m.globalRead || m.readSquads?.includes(squad))));
}
