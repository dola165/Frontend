import type * as api from './api';
import { useJourneyCopy } from './journeyCopy';

/** The room to show: the one asked for if the reader is in it, else one with something new, else their first. No rooms in a one-room squad. */
export const activeRoom = (space: api.SquadOverview, asked?: string | null): api.SquadRoom | null => {
    const rooms = space.rooms;
    if (!rooms?.separate || !rooms.mine.length) return null;
    return rooms.mine.find(room => room === asked) ?? rooms.mine.find(room => (rooms.unread[room] ?? 0) > 0) ?? rooms.mine[0];
};

export const useRoomCopy = () => {
    const copy = useJourneyCopy();
    return (room: api.SquadRoom | null) => room === 'PLAYERS'
        ? { title: copy('Players’ room', 'მოთამაშეების ოთახი'), who: copy('For the squad’s players and coaches.', 'გუნდის მოთამაშეებისა და მწვრთნელებისთვის.') }
        : room === 'PARENTS'
            ? { title: copy('Parents’ room', 'მშობლების ოთახი'), who: copy('For the squad’s parents and coaches.', 'გუნდის მშობლებისა და მწვრთნელებისთვის.') }
            : { title: copy('Squad chat', 'გუნდის ჩატი'), who: copy('For everyone in the squad and its coaches.', 'გუნდის ყველა წევრისა და მწვრთნელებისთვის.') };
};
