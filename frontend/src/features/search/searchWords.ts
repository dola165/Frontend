import { shortDate } from '../teamWork/teamWorkWords';
import type { HitKind, SearchFile, SearchGroup, SearchWhy } from './api';

type Copy = (english: string, georgian: string) => string;

export const groupName = (copy: Copy, group: SearchGroup) => ({
    WORK: copy('Tasks and plans', 'საქმეები და გეგმები'),
    CHATS: copy('Chats', 'ჩატები'),
    FILES: copy('Pictures and files', 'სურათები და ფაილები'),
})[group];

export const kindName = (copy: Copy, kind: HitKind) => ({
    TASK: copy('Task', 'საქმე'), STEP: copy('Step', 'ნაბიჯი'), IDEA: copy('Idea', 'იდეა'), WAITING: copy('Waiting', 'მოლოდინში'),
    PLAN: copy('Plan', 'გეგმა'), NOW: copy('Now note', 'ახლა'), MESSAGE: copy('Message', 'შეტყობინება'),
    CHAT_FILE: copy('File', 'ფაილი'), TASK_FILE: copy('File', 'ფაილი'), KEPT_FILE: copy('Kept file', 'შენახული ფაილი'),
})[kind];

export const fileName = (copy: Copy, file: SearchFile | null, title: string | null) => title ?? ({
    IMAGE: copy('Picture', 'სურათი'), VIDEO: copy('Video', 'ვიდეო'), FILE: copy('File', 'ფაილი'),
})[file?.kind ?? 'FILE'];

export const planStatusName = (copy: Copy, status: string | null) => status === 'NOW' ? copy('Now', 'ახლა')
    : status === 'LATER' ? copy('Later', 'მოგვიანებით') : status === 'FINISHED' ? copy('Finished', 'დასრულებული') : null;

/** What the words matched, said before them: "What it's for:", "Comment by Ilo:". Names, keys and messages need no label. */
export const whyLabel = (copy: Copy, why: SearchWhy): string | null => {
    const by = why.by ?? copy('someone', 'ვიღაც');
    switch (why.field) {
        case 'PURPOSE': return copy('What it’s for', 'რისთვისაა');
        case 'DONE_MEANS': return copy('Done means', 'მზადაა, როცა');
        case 'NOTES': return copy('Notes', 'შენიშვნები');
        case 'PLAN': return copy('Part of', 'ნაწილია');
        case 'PERSON': return copy('Who', 'ვინ');
        case 'COMMENT': case 'NOW_COMMENT': return copy(`Comment by ${by}`, `კომენტარი — ${by}`);
        case 'QUESTION': return copy('Question', 'კითხვა');
        case 'OLD_PURPOSE': return copy('Was for', 'ადრე იყო');
        case 'NOW_NOTE': return copy('Now', 'ახლა');
        case 'MENTION': return copy('About', 'შესახებ');
        case 'FILE_NAME': return copy('File name', 'ფაილის სახელი');
        case 'SENT_WITH': return copy(`Sent by ${by} with`, `გამოგზავნა ${by}`);
        case 'TASK': return copy('On the task', 'საქმეზე');
        case 'CHAT': return copy('In the chat', 'ჩატში');
        case 'CHAT_TASK': return copy('The chat is about', 'ჩატი ეხება');
        default: return null;
    }
};

/** "23 Oct, 10:05", or "today, 10:05". */
export const when = (copy: Copy, iso: string | null) => {
    if (!iso) return null;
    const date = new Date(iso), today = new Date();
    const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const day = date.toDateString() === today.toDateString() ? copy('today', 'დღეს') : shortDate(copy, date);
    return `${day}, ${time}`;
};

