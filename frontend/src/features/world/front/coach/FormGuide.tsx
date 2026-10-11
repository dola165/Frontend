import { useWorldCopy } from '../../copy';
import { shortDate } from '../../format';
import type { FormResult } from './form';
import './coach.css';

const WORD = { W: 'won', D: 'drew', L: 'lost' } as const;

/** A team's last results as W/D/L squares, newest on the left, each naming its match on hover. */
export function FormGuide({ results }: { results: FormResult[] }) {
    const t = useWorldCopy();
    if (!results.length) return <span className="gk-form__none">{t('No results yet')}</span>;
    return (
        <span className="gk-form" role="img" aria-label={`${t('Form')}: ${results.map(result => `${t(WORD[result.outcome])} ${result.scored}–${result.conceded} ${t('v')} ${result.opponentName}${result.startsAt ? `, ${shortDate(result.startsAt)}` : ''}`).join('; ')}`}>
            {results.map(result => <span key={result.id} className="gk-form__r" data-r={result.outcome} aria-hidden="true"
                title={`${result.outcome} ${result.scored}–${result.conceded} ${t('v')} ${result.opponentName}${result.startsAt ? `, ${shortDate(result.startsAt)}` : ''}`}>{t(result.outcome)}</span>)}
        </span>
    );
}
