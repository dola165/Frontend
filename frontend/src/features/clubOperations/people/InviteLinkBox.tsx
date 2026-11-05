import { useId, useState } from 'react';
import { Copy, MessageCircle, X } from 'lucide-react';
import { Button } from '../../../design/primitives';
import { formatDate } from '../../../utils/formatting';
import { inviteUrl, whatsAppUrl, type InviteLink } from './api';
import { useJobWords } from './jobWords';

/**
 * The one-time link for an invited person, shown to whoever sends it on: copy it, or open WhatsApp with it.
 * Only this session sees it; New link makes another and the old one stops working. Only the note is announced.
 */
export function InviteLinkBox({ name, link, message, onClose }: { name: string; link: InviteLink; message: string; onClose?: () => void }) {
    const { copy } = useJobWords();
    const id = useId();
    const [copied, setCopied] = useState<'yes' | 'failed' | null>(null);
    const url = inviteUrl(link.token);
    const until = formatDate(link.expiresAt, { day: 'numeric', month: 'short' });
    const copyLink = () => {
        if (!navigator.clipboard) { setCopied('failed'); return; }
        navigator.clipboard.writeText(url).then(() => setCopied('yes'), () => setCopied('failed'));
    };
    return <div className="pp-link">
        <label htmlFor={id} className="pp-link__label">{copy(`Invite link for ${name}`, `მოწვევის ბმული: ${name}`)}</label>
        <div className="pp-link__row">
            <input id={id} className="gk-input gk-num" readOnly value={url} onFocus={event => event.target.select()} />
            <Button size="sm" variant="primary" onClick={copyLink}><Copy aria-hidden="true" />{copied === 'yes' ? copy('Copied', 'დაკოპირდა') : copy('Copy', 'კოპირება')}</Button>
            <a className="gk-btn gk-btn--sm gk-btn--secondary" href={whatsAppUrl(`${message} ${url}`)} target="_blank" rel="noreferrer"><MessageCircle aria-hidden="true" />WhatsApp</a>
            {onClose && <Button size="sm" iconOnly variant="ghost" aria-label={copy('Hide the link', 'ბმულის დამალვა')} onClick={onClose}><X aria-hidden="true" /></Button>}
        </div>
        <p className="gk-faint pp-link__note" role="status">{copied === 'failed' ? copy('Copying didn’t work here. Select the link in the box and copy it.', 'კოპირება ვერ მოხერხდა. მონიშნეთ ბმული ველში და დააკოპირეთ.')
            : copy(`Works once, until ${until}. ${name} chooses their own password; nobody else sees it.`, `მუშაობს ერთხელ, ${until}-მდე. ${name} თავად ირჩევს პაროლს და მას სხვა ვერავინ ხედავს.`)}</p>
    </div>;
}
