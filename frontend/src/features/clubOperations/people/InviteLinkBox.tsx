import { useId, useState } from 'react';
import { Copy, MessageCircle, X } from 'lucide-react';
import { Button } from '../../../design/primitives';
import { formatDate } from '../../../utils/formatting';
import { inviteUrl, whatsAppUrl, type InviteLink } from './api';
import { useJobWords } from './jobWords';

/**
 * The one-time link for an invited person, shown to whoever sends it on: copy it, or open WhatsApp with it.
 * Only this session sees it; New link makes another and the old one stops working.
 */
export function InviteLinkBox({ name, link, message, onClose }: { name: string; link: InviteLink; message: string; onClose?: () => void }) {
    const { copy } = useJobWords();
    const id = useId();
    const [copied, setCopied] = useState(false);
    const url = inviteUrl(link.token);
    const until = formatDate(link.expiresAt, { day: 'numeric', month: 'short' });
    return <div className="pp-link" role="status">
        <label htmlFor={id} className="pp-link__label">{copy(`Invite link for ${name}`, `მოწვევის ბმული: ${name}`)}</label>
        <div className="pp-link__row">
            <input id={id} className="gk-input gk-num" readOnly value={url} onFocus={event => event.target.select()} />
            <Button size="sm" variant="primary" onClick={() => void navigator.clipboard?.writeText(url).then(() => setCopied(true))}><Copy aria-hidden="true" />{copied ? copy('Copied', 'დაკოპირდა') : copy('Copy', 'კოპირება')}</Button>
            <a className="gk-btn gk-btn--sm gk-btn--secondary" href={whatsAppUrl(`${message} ${url}`)} target="_blank" rel="noreferrer"><MessageCircle aria-hidden="true" />WhatsApp</a>
            {onClose && <Button size="sm" iconOnly variant="ghost" aria-label={copy('Hide the link', 'ბმულის დამალვა')} onClick={onClose}><X aria-hidden="true" /></Button>}
        </div>
        <p className="gk-faint pp-link__note">{copy(`Works once, until ${until}. ${name} chooses their own password; nobody else sees it.`,
            `მუშაობს ერთხელ, ${until}-მდე. ${name} თავად ირჩევს პაროლს და მას სხვა ვერავინ ხედავს.`)}</p>
    </div>;
}
