import { createContext } from 'react';

/**
 * The side a person reports for when the place that opened the score already knows it (`reportAs` from
 * `/me/results-waiting`); the report form starts on it when the record lets them report for it.
 */
export const ReportAsContext = createContext<'HOME' | 'AWAY' | 'REFEREE' | null>(null);
