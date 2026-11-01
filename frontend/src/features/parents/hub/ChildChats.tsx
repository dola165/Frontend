import { Link } from 'react-router-dom';
import { ChevronRight, MessageCircle, Send } from 'lucide-react';
import { Count, Section } from '../../../design/primitives';
import { Crest, FaceStack } from '../../../design/visuals';
import { squadMessageUrl } from '../../squadCommunication/routes';
import { useClubCrest } from '../../squadCommunication/useClubCrest';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import type * as api from '../../squadCommunication/api';
import type { JoiningChild } from '../api';
import { firstName } from './childFacts';
import './parent-hub.css';

/**
 * Chat: each squad's chat, where the coaches and the parents talk (the parent is in it through the child, never in the
 * child's own chats), and "Message the coaches", the family's own thread with them.
 */
export function ChildChats({ squads, child }: { squads: api.SquadOverview[]; child: JoiningChild }) {
    const copy = useJourneyCopy();
    const first = firstName(child);
    if (!squads.length) return null;
    return <Section boxed icon={MessageCircle} tone="violet" title={copy('Chat', 'ჩატი')} className="ph-section ph-chats" id="chats">
        <ul className="ph-rows">
            {squads.map(squad => <li key={squad.id}><SquadChat squad={squad} /></li>)}
            {squads.map(squad => {
                const own = squad.threads?.find(thread => thread.user_id === squad.viewer_id);
                const coaches = squad.coaches.map(coach => ({ id: coach.user_id, name: coach.full_name }));
                return <li key={`coaches-${squad.id}`}><Link className="ph-row" to={squadMessageUrl(squad.id, true)} data-guide="message-coaches">
                    {coaches.length ? <FaceStack people={coaches} max={2} size={24} /> : <span className="ph-row__icon" aria-hidden="true"><Send /></span>}
                    <span className="ph-row__text"><strong>{squads.length > 1 ? copy(`Message the ${squad.name} coaches`, `მისწერეთ ${squad.name}-ის მწვრთნელებს`) : copy('Message the coaches', 'მისწერეთ მწვრთნელებს')}</strong>
                        <small>{copy(`Just you and ${first}’s coaches`, `მხოლოდ თქვენ და ${first}-ს მწვრთნელები`)}</small></span>
                    {own?.unread_count ? <Count value={own.unread_count} /> : <ChevronRight aria-hidden="true" />}
                </Link></li>;
            })}
        </ul>
    </Section>;
}

function SquadChat({ squad }: { squad: api.SquadOverview }) {
    const copy = useJourneyCopy();
    const crest = useClubCrest(squad.club_id);
    return <Link className="ph-row" to={squadMessageUrl(squad.id)} data-guide="squad-chat">
        <Crest src={crest} name={squad.academy_name} size={24} />
        <span className="ph-row__text"><strong>{squad.name}</strong><small>{copy('Coaches and parents', 'მწვრთნელები და მშობლები')}{squad.unread_count ? ` · ${copy(`${squad.unread_count} new`, `${squad.unread_count} ახალი`)}` : ''}</small></span>
        {squad.unread_count ? <Count value={squad.unread_count} /> : <ChevronRight aria-hidden="true" />}
    </Link>;
}
