import { ArrowLeft } from 'lucide-react';
import { ButtonLink, PageFrame } from '../../../design/primitives';
import { SquadPage as SharedSquadPage } from '../../squadCommunication/page/SquadPage';
import { coachHubEn } from '../../../locales/workspaceDesign';
import { useCopy } from '../../../locales/useCopy';
import './coach-hub.css';

/**
 * One squad's page, inside My squads: the same squad page a family reaches from Parent Hub (updates, schedule,
 * players, grounds), with the coach's controls, framed by My squads' rail and the way back to all squads.
 */
export function SquadPage({ squad }: { squad: number }) {
    const copy = useCopy('coachHub', coachHubEn);
    return <PageFrame className="cw-page ch-page">
        <div className="ch-squad-page__back"><ButtonLink size="sm" to="/my-squads"><ArrowLeft aria-hidden="true" />{copy('mySquads')}</ButtonLink></div>
        <SharedSquadPage id={squad} embedded />
    </PageFrame>;
}
