import type { PageBoxes, SavableBox } from '../api';

/** A box as it is saved (`PUT …/page/boxes/:key`), from the box as it is read: what Undo sends back. */
export function boxData<K extends SavableBox>(key: K, box: PageBoxes[K]): unknown {
  switch (key) {
    case 'grounds': return { items: (box as PageBoxes['grounds']).items };
    case 'squads': return { items: (box as PageBoxes['squads']).items.map(squad => ({ id: squad.id, name: squad.name, ageGroup: squad.ageGroup, gender: squad.gender, days: squad.days, time: squad.time, groundId: squad.groundId })) };
    case 'fees': return { band: (box as PageBoxes['fees']).band };
    case 'staff': return { invites: (box as PageBoxes['staff']).invites };
    case 'players': return { shared: (box as PageBoxes['players']).shared };
    case 'sponsors': return { items: (box as PageBoxes['sponsors']).items };
    case 'honours': return { items: (box as PageBoxes['honours']).items };
    case 'involved': return { parts: (box as PageBoxes['involved']).parts };
    default: return {};
  }
}
