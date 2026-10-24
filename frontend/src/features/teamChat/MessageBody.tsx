import { Fragment, useId, useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { statusName, statusWords } from '../teamWork/teamWorkWords';
import type { WorkStatus } from '../teamWork/api';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { ChatMessage, ChatPerson, ChatTaskRef } from './api';
import { parts, taskPath } from './richText';

/** A task key as a link to the task, with its name and status on hover and on keyboard focus. */
function TaskLink({ text, task }: { text: string; task: ChatTaskRef }) {
    const copy = useJourneyCopy();
    const id = useId();
    const status = task.status as WorkStatus;
    return <Link className="tc-task" to={taskPath(task)} aria-describedby={id}>
        {text}
        <span id={id} role="tooltip" className="tc-task__card" data-status={task.status}>
            <span className="tc-task__status"><span className="tc-dot" aria-hidden="true" />{status in statusWords ? statusName(copy, status) : task.status}</span>
            <span className="tc-task__title">{task.title}</span>
        </span>
    </Link>;
}

/** A message's words: mentions stand out (more when it is you), task keys and links can be followed; `trailing` ends the line ("edited"). */
export function MessageBody({ message, members, me, trailing }: { message: ChatMessage; members: Map<number, ChatPerson>; me: number | null; trailing?: ReactNode }) {
    const pieces = useMemo(() => {
        const mentioned = message.mentions.flatMap(id => members.get(id) ? [members.get(id) as ChatPerson] : []);
        return parts(message.content, mentioned, message.tasks);
    }, [message.content, message.mentions, message.tasks, members]);
    if (!message.content) return null;
    return <p className="tc-msg__text" data-chat-message-content="">
        {pieces.map((part, index) => {
            if (part.kind === 'text') return <Fragment key={index}>{part.text}</Fragment>;
            if (part.kind === 'task') return <TaskLink key={index} text={part.text} task={part.task} />;
            if (part.kind === 'mention') return <span key={index} className="tc-mention" data-me={part.person.id === me || undefined}>{part.text}</span>;
            return part.internal
                ? <Link key={index} className="tc-link" to={part.internal}>{part.text}</Link>
                : <a key={index} className="tc-link" href={part.href} target="_blank" rel="noopener noreferrer">{part.text}</a>;
        })}
        {trailing && <> {trailing}</>}
    </p>;
}
