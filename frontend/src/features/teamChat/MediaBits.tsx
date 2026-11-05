import './team-chat-media.css';
import { Play } from 'lucide-react';
import { useContextMenu } from '../../components/useContextMenu';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { ChatAttachment } from './api';
import { ChatImage, ChatVideo, FileRow } from './Attachments';
import { mediaMenu, type MediaActions } from './mediaMenu';
import { shownName } from './mediaWords';

/** Its tags as small quiet words under its name. */
export function TagList({ tags }: { tags?: string[] }) {
    const copy = useJourneyCopy();
    if (!tags?.length) return null;
    return <ul className="tc-tags" aria-label={copy('Tags', 'თეგები')}>{tags.map(tag => <li key={tag}>{tag}</li>)}</ul>;
}

/**
 * A picture or a video as a tile with its name under it (and its tags), opening full screen; right-click (or hold)
 * for the rest. `caption` says who shared it, where and when.
 */
export function MediaTile({ attachment, caption, actions, named = true }: { attachment: ChatAttachment; caption: string; actions: MediaActions; named?: boolean }) {
    const copy = useJourneyCopy();
    const menu = useContextMenu(() => mediaMenu(copy, attachment, actions), { label: shownName(attachment) });
    return <li className="tc-mtile">
        <button type="button" className="tc-tile gk-cm-target" onClick={actions.onOpen} {...menu.bind}
            aria-label={`${shownName(attachment)}, ${caption}`} title={caption}>
            {attachment.kind === 'VIDEO'
                ? <><ChatVideo attachment={attachment} className="tc-tile__media" /><span className="tc-tile__play"><Play aria-hidden="true" /></span></>
                : <ChatImage attachment={attachment} lazy className="tc-tile__media" />}
        </button>
        {named && <span className="tc-mtile__name" title={attachment.title ? `${attachment.title} · ${attachment.name}` : attachment.name}>{shownName(attachment)}</span>}
        {named && <TagList tags={attachment.tags} />}
        {menu.menu}
    </li>;
}

/** A file as a row to save, with where it came from beside it; right-click (or hold) for the rest. */
export function MediaFileRow({ attachment, caption, actions, place }: { attachment: ChatAttachment; caption: string; actions: MediaActions; place?: React.ReactNode }) {
    const copy = useJourneyCopy();
    const menu = useContextMenu(() => mediaMenu(copy, attachment, actions), { label: shownName(attachment) });
    return <li className="tc-mfile gk-cm-target" {...menu.bind}>
        <FileRow attachment={attachment} />
        <span className="tc-mfile__about">
            {place}
            <span className="tc-faint">{caption}</span>
            <TagList tags={attachment.tags} />
        </span>
        {menu.menu}
    </li>;
}
