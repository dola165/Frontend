import type { ChoiceFilter } from '../directory/types';

/** "How to join" means the same in the club directory and on the World map. */
export const JOIN_POLICY_FILTER: ChoiceFilter = {
    kind: 'choice', key: 'joinPolicy', label: 'How to join', primary: true, multi: true, options: [
        { value: 'OPEN_TRIAL', label: 'Open trials' }, { value: 'APPLICATION_REQUIRED', label: 'Apply to join' }, { value: 'INVITE_ONLY', label: 'Invite only' },
    ],
};
