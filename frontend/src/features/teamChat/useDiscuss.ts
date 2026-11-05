import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createChat } from './api';

/** A task as Discuss needs it: its chat (if it has one) and whether that chat is for chosen people you are not in. */
export type Discussed = { id: number; key: string; chatId?: number | null; chatMessages?: number; chatPrivate?: boolean };

/** Opens a task's chat, or starts it (named after the task, for everyone on the team) the first time. */
export function useDiscuss() {
    const navigate = useNavigate();
    return useCallback(async (task: Discussed) => {
        if (task.chatId) { navigate(`/team-work/chat?chat=${task.chatId}`); return; }
        const chat = await createChat({ taskId: task.id });
        navigate(`/team-work/chat?chat=${chat.id}`);
    }, [navigate]);
}
