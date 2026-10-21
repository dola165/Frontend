import type { ReactNode } from 'react';

/** Completion is an acknowledged action, never a closed editor or an optimistic UI update. */
export type GuideResult = { status: 'complete' } | { status: 'stay'; message?: string };
export interface GuideTask {
  /** Stable identity across refreshed lists; do not recycle an ID for different work. */
  id: string;
  title: string;
  description?: string;
  target?: string;
  content?: ReactNode;
  enter?: () => void;
  next: () => Promise<GuideResult> | GuideResult;
  nextLabel?: string;
  canSkip?: boolean;
  disabled?: boolean;
}
export interface GuideTaskAdapter {
  next: () => Promise<GuideResult> | GuideResult;
  disabled?: boolean;
  nextLabel?: string;
}
