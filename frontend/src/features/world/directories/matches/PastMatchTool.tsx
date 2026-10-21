import { HistoricalMatchImport } from '../../../matchHistory/HistoricalMatchImport';
import { first, type NavProps } from '../../directory/types';
import '../../../matchExchange/match-exchange.css';
import '../../../matchHistory/match-history.css';

/**
 * Adding a past match is club record-keeping, offered beside fixtures and results on every view to the staff who may
 * do it (the tool hides itself for everyone else).
 */
export function PastMatchTool({ query, onSaved }: Pick<NavProps, 'query'> & { onSaved: () => void }) {
    return <div className="gk-world-legacy gk-world-past"><HistoricalMatchImport clubId={Number(first(query, 'clubId')) || undefined} onSaved={onSaved} /></div>;
}
