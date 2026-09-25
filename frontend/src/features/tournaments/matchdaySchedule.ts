import type { TournamentDetail, TournamentFixtureDto } from './domain';
import { participantName } from './participantLabels';

export interface MatchdayKickoff {
    day: string;
    time: string;
    order: number;
    comparisonKey: string;
}

// Tournament kickoffs currently use LocalDateTime, not instants. Preserve the
// entered calendar date/time on every browser; do not invent a venue time zone.
export function matchdayKickoff(value: string | null): MatchdayKickoff | null {
    if (!value) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:\d{2})?$/.exec(value);
    if (!match) return null;
    const [, year, month, day, hour, minute, second = '0', fraction = '0', offset] = match;
    const order = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second, +(fraction + '00').slice(0, 3));
    const date = new Date(order);
    if (date.getUTCFullYear() !== +year || date.getUTCMonth() !== +month - 1 || date.getUTCDate() !== +day
        || +hour > 23 || +minute > 59 || +second > 59) return null;
    if (offset && offset !== 'Z' && (+offset.slice(1, 3) > 23 || +offset.slice(4) > 59)) return null;
    const offsetMinutes = !offset || offset === 'Z' ? 0
        : (+offset.slice(1, 3) * 60 + +offset.slice(4)) * (offset[0] === '-' ? -1 : 1);
    // Legacy/demo responses may include an offset. Compare those as instants,
    // but never assume an offset-free kickoff is UTC when mixing both forms.
    const comparisonKey = offset ? `instant:${order - offsetMinutes * 60_000}` : `local:${order}`;
    return { day: `${year}-${month}-${day}`, time: `${hour}:${minute}`, order, comparisonKey };
}

export interface MatchdayRow {
    fixture: TournamentFixtureDto;
    kickoff: MatchdayKickoff | null;
    home: string;
    away: string;
    stage: string | null;
    missingTime: boolean;
    conflictingIds: number[];
}

export function buildMatchdaySchedule(tournament: TournamentDetail): MatchdayRow[] {
    const entries = new Map(tournament.entries.map(entry => [entry.id, entry]));
    const stages = new Map(tournament.stages.map(stage => [stage.id, stage.name]));
    const rows: MatchdayRow[] = tournament.fixtures.map(fixture => {
        const kickoff = matchdayKickoff(fixture.scheduledAt);
        const home = fixture.homeEntryId == null ? undefined : entries.get(fixture.homeEntryId);
        const away = fixture.awayEntryId == null ? undefined : entries.get(fixture.awayEntryId);
        return {
            fixture, kickoff,
            home: home ? participantName(home) : fixture.homeLabel || '',
            away: away ? participantName(away) : fixture.awayLabel || '',
            stage: fixture.stageName || (fixture.stageId == null ? null : stages.get(fixture.stageId)) || null,
            missingTime: fixture.status === 'SCHEDULED' && kickoff == null,
            conflictingIds: [],
        };
    });
    const byTeamAndTime = new Map<string, MatchdayRow[]>();
    for (const row of rows) {
        if (row.fixture.status !== 'SCHEDULED' || !row.kickoff) continue;
        for (const entryId of new Set([row.fixture.homeEntryId, row.fixture.awayEntryId])) {
            if (entryId == null) continue;
            const key = `${entryId}:${row.kickoff.comparisonKey}`;
            const group = byTeamAndTime.get(key) ?? [];
            group.push(row);
            byTeamAndTime.set(key, group);
        }
    }
    const conflicts = new Map<number, Set<number>>();
    for (const group of byTeamAndTime.values()) {
        if (group.length < 2) continue;
        for (const row of group) {
            const ids = conflicts.get(row.fixture.id) ?? new Set<number>();
            for (const other of group) if (other.fixture.id !== row.fixture.id) ids.add(other.fixture.id);
            conflicts.set(row.fixture.id, ids);
        }
    }
    for (const row of rows) row.conflictingIds = [...(conflicts.get(row.fixture.id) ?? [])];
    return rows.sort((a, b) => (a.kickoff?.order ?? Infinity) - (b.kickoff?.order ?? Infinity)
        || (a.fixture.fixtureOrder ?? Infinity) - (b.fixture.fixtureOrder ?? Infinity)
        || a.fixture.id - b.fixture.id);
}

export function formatMatchday(day: string, language: string): string {
    return new Intl.DateTimeFormat(language.startsWith('ka') ? 'ka-GE' : 'en-GB', {
        weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
    }).format(new Date(`${day}T12:00:00Z`));
}
