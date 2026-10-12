import type { CopyVars } from '../copy';
import type { MatchState } from './matchState';
import type { LineState } from './Scoreboard';

type Translate = (en: string, vars?: CopyVars) => string;

/** A match state as a score line's time column: the kick-off time, or the translated word in its place. */
export const lineState = (state: MatchState, t: Translate): { state?: LineState; time?: string } => 'time' in state.when
    ? { time: state.when.time }
    : { state: { word: t(state.when.word), code: state.code, tone: state.when.tone, spoken: state.when.spoken && t(state.when.spoken) } };
