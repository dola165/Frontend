import type { LockedAction } from '../model/kinds';

/** What each locked action is for, in the sheet's title: "To sell kit, verify your club". */
export const UNLOCK_WORDS: Record<LockedAction, string> = {
  SELL: 'sell kit', TAKE_PAYMENTS: 'take payments', FUNDRAISE: 'raise money', PUBLIC_MINORS: 'show players under 18 publicly', PUBLIC_TRIALS: 'open trials to the public', VERIFIED_BADGE: 'show the Verified badge',
};

