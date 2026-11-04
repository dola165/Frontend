export const squadMessageUrl = (id: number, coaching = false, thread?: number | null, room?: string | null) =>
    `/messages?squadId=${id}${coaching ? '&channel=coach' : ''}${coaching && thread ? `&thread=${thread}` : ''}${!coaching && room ? `&room=${room}` : ''}`;
