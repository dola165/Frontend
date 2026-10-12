import type { ReactNode } from 'react';
import { MatchLine, type Side } from '../../world/scoreboard/Scoreboard';
import { label, type Squad } from '../api';
import { addMinutes, dayLabel, defaultFormat, defaultMinutes, formatLabel, groundLocation, hostingOf, type Draft, type Mode } from './matchPlan';

const REFEREE: Record<Draft['referee'], string> = { US: 'Referee later', THEM: 'They arrange the referee', INVITE: 'Referee invited', OPEN: 'Referees nearby can apply', EXTERNAL: 'Referee arranged', NONE: 'No referee' };

/**
 * The match as it will appear once sent: the same score line as every list (kick-off, the two sides with their crests,
 * the home side on top), the ground with who hosts, and the age group, format, length and referee under it.
 */
export function MatchPreview({ mode, draft, squad, ourLogo, ageGroup, targetSquadName, refereeWords, children }: {
    mode: Mode; draft: Draft; squad: Squad | null; ourLogo?: string | null; ageGroup: string; targetSquadName: string | null;
    /** The referee as things stand (an edited match's appointment), until the person changes it. */ refereeWords?: string;
    /** Above the line (the choice of invite or open match). */ children?: ReactNode;
}) {
    const minutes = draft.minutes ?? defaultMinutes(ageGroup);
    const hosting = hostingOf(draft);
    const ground = groundLocation(draft.ground);
    const ours: Side = squad ? { name: `${squad.club_name} ${squad.name}`, logo: ourLogo, mine: true } : { name: 'Your squad', ghost: true };
    const theirs: Side = mode === 'open' ? { name: 'Opponent wanted', ghost: true }
        : draft.opponent ? { name: [draft.opponent.name, targetSquadName].filter(Boolean).join(' '), logo: draft.opponent.logoUrl }
            : { name: mode === 'edit' ? 'Opponent not agreed yet' : 'Opponent', ghost: true };
    const where = draft.ground.kind === 'LATER' ? `Ground to agree${ground.city ? ` · ${ground.city}` : ''}`
        : draft.ground.kind === 'TRAVEL' ? `At their ground${ground.city ? ` · ${ground.city}` : ''}`
            : ground.locationName ? [ground.locationName, ground.city].filter(Boolean).join(' · ') : 'Choose a ground';
    const host = hosting === 'HOME' ? 'You host' : hosting === 'AWAY' ? 'You travel' : hosting === 'NEUTRAL' ? 'Neutral ground' : null;
    return (
        <div className="gk-arrange__preview" aria-label="Match preview">
            {children}
            <ul className="gk-sb__rows">
                <MatchLine time={draft.time || '--:--'} day={draft.date ? dayLabel(draft.date) : 'Choose a day'}
                    home={hosting === 'AWAY' ? theirs : ours} away={hosting === 'AWAY' ? ours : theirs} />
            </ul>
            <p className="gk-arrange__where">{where}{host && <b>{host}</b>}</p>
            {/* Until a squad is chosen the age group, format and length are not known (they follow the squad). */}
            <p className="gk-arrange__terms">{[...(squad || draft.ageGroup ? [label(ageGroup), formatLabel(draft.format ?? defaultFormat(ageGroup)), `${minutes} min`,
                draft.date && draft.time ? `ends ${addMinutes(`${draft.date}T${draft.time}`, minutes).slice(11)}` : null] : ['Format and length follow your squad']),
                refereeWords ?? (mode === 'edit' && draft.referee === 'US' ? 'Referee needed' : REFEREE[draft.referee])].filter(Boolean).join(' · ')}</p>
        </div>
    );
}
