import { Download, ExternalLink, Images, Maximize2, MessageSquare, PencilLine, Play, Tag } from 'lucide-react';
import type { ContextMenuItems } from '../../components/useContextMenu';
import type { ChatAttachment } from './api';
import type { Copy } from './teamChatWords';

/**
 * What can be done with one picture, video or file wherever it is shown. Each is given only where it applies; editing
 * a picture says why it cannot be done when it cannot (a deleted chat, the Kept files shelf).
 */
export interface MediaActions {
    onOpen?: () => void;
    /** "Show in chat": the message it came in. */
    onShow?: () => void;
    /** "Open the task": the task it is on, or its chat's task. */
    onTask?: () => void;
    /** "Show in media": the media page, at this chat. */
    onMedia?: () => void;
    onLabel?: () => void;
    onSave?: () => void;
    onEdit?: () => void;
    /** Why the picture cannot be edited here, when it cannot. */
    noEdit?: string;
}

/** The menu for one picture, video or file: open it, go where it lives, name it, save it, edit the picture. */
export function mediaMenu(copy: Copy, attachment: ChatAttachment, actions: MediaActions): ContextMenuItems {
    return [
        actions.onOpen && { key: 'open', label: attachment.kind === 'VIDEO' ? copy('Play', 'ჩართვა') : copy('Open', 'გახსნა'), icon: attachment.kind === 'VIDEO' ? Play : Maximize2, onSelect: actions.onOpen },
        actions.onShow && { key: 'show', label: copy('Show in chat', 'ჩატში ნახვა'), icon: MessageSquare, onSelect: actions.onShow },
        actions.onTask && { key: 'task', label: copy('Open the task', 'საქმის გახსნა'), icon: ExternalLink, onSelect: actions.onTask },
        actions.onMedia && { key: 'media', label: copy('Show in media', 'მედიაში ნახვა'), icon: Images, onSelect: actions.onMedia },
        actions.onLabel && { key: 'label', label: copy('Name and tags…', 'სახელი და თეგები…'), icon: Tag, separated: true, onSelect: actions.onLabel },
        actions.onSave && { key: 'save', label: copy('Download', 'ჩამოტვირთვა'), icon: Download, separated: !actions.onLabel, onSelect: actions.onSave },
        attachment.kind === 'IMAGE' && (actions.onEdit || actions.noEdit) && {
            key: 'edit', label: copy('Edit picture', 'სურათის რედაქტირება'), icon: PencilLine, disabled: !actions.onEdit, reason: actions.noEdit,
            onSelect: actions.onEdit ?? (() => undefined),
        },
    ];
}
