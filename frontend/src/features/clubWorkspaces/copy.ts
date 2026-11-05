import type { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { JobWorkspace, WorkspaceKey } from './types';

export type WorkspaceCopy = ReturnType<typeof useJourneyCopy>;

// Only the new product destinations. Canonical tool labels/descriptions stay in workspaceNavigation.
const deskTitlesKa: Record<WorkspaceKey, string> = {
    office: 'კლუბის ოფისი', squads: 'ჩემი გუნდები', projects: 'პროექტები', registration: 'რეგისტრაცია',
    money: 'ფინანსები', kit: 'ინვენტარი', travel: 'მგზავრობა', media: 'მედია', 'player-file': 'მოთამაშის საქმე',
    safeguarding: 'დაცვა და უსაფრთხოება', scouting: 'სკაუტინგი', facilities: 'ინფრასტრუქტურა', matches: 'მატჩები', shared: 'საერთო საქმეები',
};

/** Product labels use stable destination keys for translation only. Club, job and record names remain verbatim. */
export const workspaceTitle = (workspace: Pick<JobWorkspace, 'key' | 'title'>, copy: WorkspaceCopy) => copy(workspace.title, deskTitlesKa[workspace.key]);

/** Localize only the existing hooks' fallback copy; keep server explanations and authored values intact. */
export function workspaceLoadError(message: string, copy: WorkspaceCopy) {
    if (message === 'Could not load club responsibilities.') return copy(message, 'კლუბში თქვენი მოვალეობები ვერ ჩაიტვირთა.');
    if (message === 'Could not load your workspace roles.') return copy(message, 'თქვენი სამუშაოს უფლებები ვერ ჩაიტვირთა.');
    return message;
}
