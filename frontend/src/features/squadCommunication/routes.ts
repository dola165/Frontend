export const squadMessageUrl = (id: number, coaching = false, thread?: number | null) =>
    `/messages?squadId=${id}${coaching ? '&channel=coach' : ''}${coaching && thread ? `&thread=${thread}` : ''}`;
