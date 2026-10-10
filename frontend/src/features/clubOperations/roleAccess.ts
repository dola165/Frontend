import type { BadgeTone } from '../../design/primitives';
import { responsibilitiesEn } from '../../locales/workspaceDesign';
import { translate } from '../../locales/useCopy';
import { label, moduleNames } from './api';

/** What a staff role lets a person do, in words: "Player development, Equipment (view)". Empty when it has no workspace tools. */
export const accessSummary = (permissions: string[]) => permissions
    .map(permission => `${moduleNames[permission.split(':')[0]] ?? label(permission.split(':')[0])}${permission.endsWith(':WRITE') ? '' : ' (view)'}`).join(', ');

const tones: Record<string, BadgeTone> = { PENDING: 'warning', APPROVED: 'accent', DECLINED: 'danger', WITHDRAWN: 'neutral', UNAVAILABLE: 'neutral' };
const named = new Set(['PENDING', 'APPROVED', 'DECLINED', 'WITHDRAWN']);

/** The badge for a role request, the same for the person asking and for leadership deciding. */
export const requestBadge = (status: string) => ({
    tone: tones[status] ?? 'neutral',
    text: named.has(status) ? translate('responsibilities', responsibilitiesEn, status as 'PENDING') : label(status),
});
