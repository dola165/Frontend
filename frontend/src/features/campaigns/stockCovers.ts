import community from './covers/community.svg';
import equipment from './covers/equipment.svg';
import facilities from './covers/facilities.svg';
import other from './covers/other.svg';
import travel from './covers/travel.svg';
import youth from './covers/youth.svg';

const COVERS: Record<string, string> = { COMMUNITY: community, EQUIPMENT: equipment, FACILITIES: facilities, OTHER: other, TRAVEL: travel, YOUTH: youth };

/** A stock pitch picture for each category, shipped with the app, until the club adds its own photo. */
export const stockCover = (category: string) => COVERS[category] ?? other;
