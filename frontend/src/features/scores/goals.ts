/** The two goal boxes' text while typed: home first. */
export type GoalsDraft = { home: string; away: string };
export const emptyGoals: GoalsDraft = { home: '', away: '' };
/** Both boxes hold a number of goals (0–99). */
export const goalsReady = (value: GoalsDraft) => /^\d{1,2}$/.test(value.home) && /^\d{1,2}$/.test(value.away);
export const goalsFrom = (home: number | null | undefined, away: number | null | undefined): GoalsDraft => ({ home: home == null ? '' : String(home), away: away == null ? '' : String(away) });
