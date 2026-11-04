import { useState } from 'react';
import { Link } from 'react-router-dom';
import { extractApiErrorMessage } from '../../utils/apiError';
import * as api from './api';
import { useJourneyCopy } from './journeyCopy';
import { useRoomCopy } from './squadRoomWords';
import './squad-rooms.css';

/** Those in both rooms (coaches and staff) move between them; a coach also has the one switch. */
export function SquadRoomTabs({ space, room, roomUrl, onChanged }: { space: api.SquadOverview; room: api.SquadRoom | null; roomUrl: (room: api.SquadRoom) => string; onChanged: () => void }) {
    const copy = useJourneyCopy();
    const words = useRoomCopy();
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    const rooms = space.rooms;
    if (!rooms) return null;
    const choose = async (separate: boolean) => {
        setBusy(true); setError('');
        try { await api.chooseRooms(space.id, separate); onChanged(); }
        catch (cause) { setError(extractApiErrorMessage(cause, copy('That didn’t save. Try again.', 'ვერ შეინახა. სცადეთ ხელახლა.'))); }
        finally { setBusy(false); }
    };
    const tabs = rooms.separate && rooms.mine.length > 1;
    if (!tabs && !rooms.can_switch) return null;
    return <div className="squad-rooms">
        {tabs && <nav className="squad-rooms__tabs" aria-label={copy('Rooms', 'ოთახები')}>{rooms.mine.map(item => <Link key={item} to={roomUrl(item)} aria-current={room === item ? 'page' : undefined}>
            {words(item).title}{(rooms.unread[item] ?? 0) > 0 && <span className="squad-rooms__unread" aria-label={copy(`${rooms.unread[item]} unread`, `${rooms.unread[item]} წაუკითხავი`)}>{rooms.unread[item]}</span>}
        </Link>)}</nav>}
        {rooms.can_switch && <label className="squad-rooms__switch"><input type="checkbox" role="switch" checked={rooms.separate} disabled={busy} onChange={event => void choose(event.target.checked)} /><span>{copy('Separate rooms for players and parents', 'ცალკე ოთახები მოთამაშეებისა და მშობლებისთვის')}</span></label>}
        {error && <p className="squad-error" role="alert">{error}</p>}
    </div>;
}
