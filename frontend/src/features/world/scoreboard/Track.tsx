import { useWorldCopy } from '../copy';
import type { DotState, TrackDot } from './lanes';
import './track.css';

/** Whose move each dot waits for, in words: the colour says it too, but never alone. */
const TURN: Partial<Record<DotState, string>> = { yours: 'Your turn', urgent: 'Urgent', waiting: 'Waiting' };

/**
 * An arrangement's track: four dots (opponent, ground, referee, result), each done, mine to do, urgent, waiting or not
 * needed. In a row, the dots alone with a sentence for screen readers; in a drawer (`words`), each dot with its word.
 */
export function Track({ dots, words = false }: { dots: TrackDot[]; words?: boolean }) {
    const t = useWorldCopy();
    if (!dots.length) return null;
    const turn = (dot: TrackDot) => TURN[dot.state] && t(TURN[dot.state]!);
    const said = dots.map(dot => [t(dot.word), turn(dot)].filter(Boolean).join(': ')).join(', ');
    if (words) return (
        <ol className="gk-track gk-track--words" aria-label={t('What this match needs')}>
            {dots.map(dot => <li key={dot.part} data-state={dot.state}><span className="gk-track__dot" aria-hidden="true" />{t(dot.word)}{turn(dot) && <small className="gk-track__turn">{turn(dot)}</small>}</li>)}
        </ol>
    );
    return (
        <span className="gk-track" role="img" aria-label={said} title={said}>
            {dots.map(dot => <span key={dot.part} className="gk-track__dot" data-state={dot.state} />)}
        </span>
    );
}
