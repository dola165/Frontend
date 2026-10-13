import { describeRoute, type Copy } from '../../components/layout/header/pins/describeRoute';
import { readPins, writePins } from '../../components/layout/header/pins/pinStore';
import { hasNavigationCapability, type NavigationCapabilities } from '../../context/navigationCapabilities';
import { saveFeedPreferences, saveFootballRole, type Activity } from './startApi';
import { ACTIVITIES } from './startChoices';

/**
 * What a person does in football, applied as the first run does it: the primary public football role and one pin,
 * and the activity kept with the feed preferences. Never access: that stays with the links (World follows them too).
 */
export async function applyActivity(userId: number, activity: Activity, copy: Copy) {
    const chosen = ACTIVITIES.find(item => item.id === activity);
    if (!chosen) return;
    const pins = readPins(userId);
    if (!pins.some(pin => pin.path === chosen.pin)) {
        const [path, search = ''] = chosen.pin.split('?');
        const described = describeRoute(path, search && `?${search}`, { myClubPath: null, copy });
        writePins(userId, [...pins, { path: chosen.pin, label: described.label ?? chosen.pin, icon: described.icon }]);
    }
    await Promise.all([saveFeedPreferences({ activity }), saveFootballRole(chosen.role)]);
}

/**
 * The activity a person's confirmed links imply, for someone who skipped the question: coaching a squad or working
 * for a club (a club they created included) → coach, a linked child → parent, a place as a player → play.
 */
export function activityFromLinks(capabilities?: NavigationCapabilities): Activity | null {
    if (['squad.workspace', 'club.workspace', 'club.operations'].some(id => hasNavigationCapability(capabilities, id))) return 'COACH';
    if (['parent.hub', 'club.family'].some(id => hasNavigationCapability(capabilities, id))) return 'PARENT';
    if (hasNavigationCapability(capabilities, 'club.player')) return 'PLAY';
    return null;
}
