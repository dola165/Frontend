import { useState } from 'react';
import { ArrowLeft, MessageCircle, Plus } from 'lucide-react';
import { ButtonLink, PageFrame, PageHeader } from '../../../design/primitives';
import { Crest } from '../../../design/visuals';
import { coachHubEn } from '../../../locales/workspaceDesign';
import { useCopy } from '../../../locales/useCopy';
import { CoachUpdates } from './CoachUpdates';
import { CoachPlayers } from './CoachPlayers';
import { RosterDialog } from './RosterDialog';
import type { CoachData } from './CoachWorkspace';
import './coach-hub.css';

/**
 * One squad's page, inside My squads: what a family reaches with "Open squad", seen by its coach. The crest and
 * name on top with the way back to all squads; the squad's updates, the parents' messages and its chats; then its
 * players as cards, with the roster managed right here.
 */
export function SquadPage({ data, squad }: { data: CoachData; squad: number }) {
    const copy = useCopy('coachHub', coachHubEn);
    const [roster, setRoster] = useState(false);
    const mine = data.mine.find(item => item.id === squad);
    const name = data.names.get(squad) ?? '';
    return <PageFrame className="cw-page ch-page">
        <div className="ch-squad-page__back"><ButtonLink size="sm" to="/my-squads"><ArrowLeft aria-hidden="true" />{copy('mySquads')}</ButtonLink></div>
        <PageHeader title={<span className="ch-squad-page__title"><Crest src={data.clubLogo} name={data.clubName} size={36} />{name}</span>}
            subtitle={[data.roleOf(squad), mine ? copy('playerCount', { count: mine.player_count }) : null].filter(Boolean).join(' · ')}
            actions={<>
                <ButtonLink to={`/messages?squadId=${squad}`}><MessageCircle aria-hidden="true" />{copy('squadChat')}</ButtonLink>
                <ButtonLink variant="primary" to={data.link('updates', { compose: '1' })}><Plus aria-hidden="true" />{copy('newAnnouncement')}</ButtonLink>
            </>} />
        <div className="gk-stack">
            {/* The players first, with the roster managed from their box; then the squad's talk. */}
            <CoachPlayers data={data} embedded onManage={data.roles.leadership ? () => setRoster(true) : undefined} />
            <CoachUpdates data={data} embedded />
        </div>
        {roster && <RosterDialog data={data} open onClose={() => setRoster(false)} />}
    </PageFrame>;
}
