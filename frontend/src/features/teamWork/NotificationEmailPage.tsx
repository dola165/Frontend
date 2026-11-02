import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BadgeCheck, Loader2, Mail, ShieldQuestion } from 'lucide-react';
import { AuthCenterCard } from '../../components/auth/AuthCenterCard';
import { authPrimaryButtonClass } from '../../components/auth/authClasses';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { confirmMail } from './api';

/**
 * The link from "Send your GrassKickZ notices here?" (`/notification-email?token=…`), opened in that inbox, signed in
 * or not: the link is the proof. One button confirms it, so a mail scanner opening the link changes nothing.
 */
export function NotificationEmailPage() {
    const copy = useJourneyCopy();
    const token = useSearchParams()[0].get('token') ?? '';
    const [state, setState] = useState<{ address: string } | 'invalid' | null>(token ? null : 'invalid');
    const [busy, setBusy] = useState(false);
    const confirm = async () => {
        setBusy(true);
        try { setState(await confirmMail(token)); } catch { setState('invalid'); } finally { setBusy(false); }
    };
    if (state === 'invalid') return <AuthCenterCard icon={<ShieldQuestion className="h-8 w-8" aria-hidden="true" />} title={copy('This link has expired or was already used', 'ბმულს ვადა გაუვიდა ან უკვე გამოყენებულია')}
        line={copy('Your row in Team work › Team shows where your notices go, and sends a new link.', 'გუნდის სამუშაო › გუნდში თქვენს ხაზზე ჩანს, სად მოდის შეტყობინებები, და იქიდან ახალი ბმულიც იგზავნება.')}>
        <Link className={authPrimaryButtonClass} to="/team-work?view=team">{copy('Open Team work', 'გუნდის სამუშაოს გახსნა')}</Link>
    </AuthCenterCard>;
    if (state) return <AuthCenterCard icon={<BadgeCheck className="h-8 w-8" aria-hidden="true" />} title={copy('Done', 'მზადაა')}
        line={<>{copy('Notices that need you now also come to', 'შეტყობინებები ახლა ასევე მოდის:')} <strong>{state.address}</strong></>}>
        <Link className={authPrimaryButtonClass} to="/team-work">{copy('Open Team work', 'გუნდის სამუშაოს გახსნა')}</Link>
    </AuthCenterCard>;
    return <AuthCenterCard icon={<Mail className="h-8 w-8" aria-hidden="true" />} title={copy('Send your notices here?', 'გამოგიგზავნოთ შეტყობინებები აქ?')}
        line={copy('Notices from Team work that need you will also come to this inbox.', 'გუნდის სამუშაოს შეტყობინებები, რომლებიც თქვენ გეხებათ, ამ ელფოსტაზეც მოვა.')}>
        <button type="button" className={authPrimaryButtonClass} disabled={busy} onClick={() => void confirm()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : copy('Yes, send them here', 'დიახ, აქ გამოგზავნეთ')}
        </button>
    </AuthCenterCard>;
}
