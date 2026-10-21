import { useMatchCopy } from '../copy';
import { Panel } from '../../../design/primitives';
import type { Match } from '../api';
import { FixtureCancellation, VenueFollowUp } from '../FixtureRecovery';
import { OpponentRecovery } from '../OfficialRequests';

/** Changes that end or reopen an arrangement live together, away from everyday planning. */
export function MatchManagement({ match: m, active, now, reload }: { match: Match; active: boolean; now: number; reload: () => void }) {
    const t = useMatchCopy();
    const recovery = active && ((m.can_arrange && !m.can_manage && m.listing_status === 'ARRANGED') || (m.can_manage && m.requested_club_id && m.listing_status === 'OPEN'));
    const cancel = m.can_manage && m.event_status === 'SCHEDULED' && m.listing_status !== 'CLOSED';
    const followUp = m.can_arrange && m.event_status === 'CANCELLED' && m.venue_status === 'NEEDS_ATTENTION';
    if (!recovery && !cancel && !followUp) return null;
    return (
        <Panel title={t("Change of plan")} as="section" className="gk-match-manage">
            <div className="gk-panel--pad gk-mx gk-match-manage__body">
                {recovery && <OpponentRecovery match={m} reload={reload} />}
                {cancel && <FixtureCancellation match={m} reload={reload} started={new Date(m.starts_at_iso).getTime() <= now} />}
                {followUp && <VenueFollowUp match={m} reload={reload} />}
            </div>
        </Panel>
    );
}
