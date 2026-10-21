import './announcements.css';
import { Pin, PinOff } from 'lucide-react';
import { GkRoot } from '../../design/primitives';
import type { SquadMessage } from '../squadCommunication/api';
import { appLanguage, formatDate } from '../../utils/formatting';
import { isPinned, pinnedText, pinnedUntil } from './pinning';

/** "Pinned until Fri 16 Oct" on an announcement, or that it no longer is. */
export function PinnedState({ message }: { message: SquadMessage }) {
    const pinned = isPinned(message);
    return <GkRoot className="gk-pin-root"><span className="gk-pin" data-expired={pinned ? undefined : ''}>{pinned ? <Pin aria-hidden="true" /> : <PinOff aria-hidden="true" />}{appLanguage() === 'ka' ? (pinned ? `მიმაგრებულია ${formatDate(pinnedUntil(message), { weekday: 'short', day: 'numeric', month: 'short' })}-მდე` : 'აღარ არის მიმაგრებული') : pinnedText(message)}</span></GkRoot>;
}
