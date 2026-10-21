import { FormatGlyph } from '../../../tournaments/shape/FormatGlyph';
import { plannedShape } from '../../../tournaments/shape/shapeOf';
import { drawEstimate, durationParts } from '../../../tournaments/create/drawEstimate';
import type { DrawDraft } from '../../../tournaments/create/drawDraft';
import { useWorldCopy } from '../../copy';
import { codeLabel, shortDate } from '../../format';
import { zoned } from '../../scoreboard/standings';

/**
 * The tournament as it will be, pinned at the top while the questions scroll: its format as a picture, the name, who
 * it is for and how many teams, when, and a labelled estimate of the matches and the time on its pitches (or the
 * matchdays of a league). What the draw decides later (the groups, two legs) is said so.
 */
export function DrawPreview({ draft, organiser }: { draft: DrawDraft; organiser?: string }) {
    const t = useWorldCopy();
    const shape = plannedShape(draft.rules, draft.entryCap)!;
    const estimate = drawEstimate(draft.rules, draft.entryCap);
    const words = (total: number) => { const { hours, minutes } = durationParts(total); return hours ? (minutes ? t('{hours} h {minutes}', { hours, minutes }) : t('{hours} h', { hours })) : t('{minutes} min', { minutes }); };
    const days = [...new Set([shortDate(zoned(draft.startDate)), shortDate(zoned(draft.endDate))].filter(Boolean))].join(' – ');
    const guess = [
        estimate.matches != null ? t('{count} matches', { count: estimate.matches }) : t('Matches come from the challenges made'),
        estimate.minutes != null ? (draft.rules.pitches === 1 ? t('about {time} on one pitch', { time: words(estimate.minutes) }) : t('about {time} on {count} pitches', { time: words(estimate.minutes), count: draft.rules.pitches }))
            : estimate.matchdays != null ? t('{count} matchdays', { count: estimate.matchdays }) : null,
    ].filter(Boolean).join(' · ');
    return (
        <header className="gk-draw__preview">
            <span className="gk-draw__glyph" aria-hidden="true"><FormatGlyph kind={shape.kind} /></span>
            <div>
                <strong>{draft.name.trim() || t('New tournament')}</strong>
                <p>{[t(shape.word), codeLabel(draft.rules.ageGroup), `${draft.rules.sideSize}v${draft.rules.sideSize}`, t('{count} teams', { count: draft.entryCap })].join(' · ')}</p>
                <p>{[days, organiser && t('by {name}', { name: organiser })].filter(Boolean).join(' · ')}</p>
                <p className="gk-draw__estimate">{guess} · <span>{t('estimate')}</span>{estimate.setAtDraw && <> · {t('groups set at the draw')}</>}</p>
            </div>
        </header>
    );
}
