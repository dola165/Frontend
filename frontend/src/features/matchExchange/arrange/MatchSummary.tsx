import type { ReactNode } from 'react';
import { Avatar } from '../../../design/primitives';
import type { Squad } from '../api';
import { addMinutes, dayLabel, defaultFormat, defaultMinutes, formatLabel, groundLocation, type Draft, type Mode } from './matchPlan';

const refereeText: Record<Draft['referee'], string> = { US: 'We arrange the referee', THEM: 'They arrange the referee', EXTERNAL: 'Already arranged', NONE: 'No referee' };

/** The match as it will be sent: who, when, where and what happens next. Holds the form's one primary action. */
export function MatchSummary({ mode, draft, squad, ageGroup, targetSquadName, title, children }: {
    mode: Mode; draft: Draft; squad: Squad | null; ageGroup: string; targetSquadName: string | null; title: string; children: ReactNode;
}) {
    const minutes = draft.minutes ?? defaultMinutes(ageGroup);
    const ground = groundLocation(draft.ground);
    const where = draft.ground.kind === 'LATER' ? `To be arranged${ground.city ? `, ${ground.city}` : ''}`
        : draft.ground.kind === 'TRAVEL' ? `At the opponent’s ground${ground.city ? `, ${ground.city}` : ''}`
            : ground.locationName ? [ground.locationName, ground.city].filter(Boolean).join(', ') : 'Choose a ground';
    const hosting = draft.ground.kind === 'OURS' ? 'You host' : draft.ground.kind === 'THEIRS' || draft.ground.kind === 'TRAVEL' ? 'You travel' : draft.ground.kind === 'LATER' ? null : 'Neutral ground';
    const next = mode === 'direct'
        ? `${draft.opponent?.name ?? 'The club'} gets your invitation and accepts or declines. The match is agreed when they accept; until then it waits in My arrangements.`
        : mode === 'open' ? 'Your match appears in Open matches. Squads propose to play and you choose one; nothing is agreed until you accept.'
            : 'If the change affects an agreed opponent, referee or ground, you will see who is affected before anything is saved.';
    return (
        <div className="gk-arrange__summary-body">
            <div className="gk-arrange__preview" aria-label="Match preview">
                <span className="gk-arrange__when">
                    <span className="gk-arrange__time gk-num">{draft.time || '--:--'}</span>
                    <span className="gk-arrange__day">{draft.date ? dayLabel(draft.date) : 'Choose a day'}</span>
                </span>
                <span className="gk-arrange__teams">
                    <span className="gk-arrange__team">{squad ? <Avatar name={squad.club_name} size={28} square /> : <span className="gk-arrange__crest-slot" aria-hidden="true" />}
                        <span><strong>{squad?.name ?? 'Your squad'}</strong><small>{squad?.club_name ?? 'Choose a squad'}</small></span></span>
                    {mode !== 'open' && <span className="gk-arrange__team">{draft.opponent ? <Avatar src={draft.opponent.logoUrl} name={draft.opponent.name} size={28} square /> : <span className="gk-arrange__crest-slot" aria-hidden="true" />}
                        <span><strong>{draft.opponent?.name ?? 'Opponent'}</strong><small>{draft.opponent ? targetSquadName ?? 'They choose the squad' : mode === 'edit' ? 'Not agreed yet' : 'Search for a club'}</small></span></span>}
                </span>
            </div>
            <dl className="gk-arrange__facts">
                {title && <div><dt>Name</dt><dd>{title}</dd></div>}
                <div><dt>Ground</dt><dd>{where}{hosting && <small>{hosting}</small>}</dd></div>
                <div><dt>Format</dt><dd>{squad || draft.format || draft.minutes ? <>{formatLabel(draft.format ?? defaultFormat(ageGroup))}, {minutes} minutes{draft.date && draft.time && <small>Ends {addMinutes(`${draft.date}T${draft.time}`, minutes).slice(11)} · {draft.timezone}</small>}</> : 'Follows your squad’s age group'}</dd></div>
                <div><dt>Referee</dt><dd>{draft.referee === 'EXTERNAL' && draft.refereeName.trim() ? draft.refereeName.trim() : refereeText[draft.referee]}</dd></div>
            </dl>
            <p className="gk-arrange__next">{next}</p>
            {children}
        </div>
    );
}
