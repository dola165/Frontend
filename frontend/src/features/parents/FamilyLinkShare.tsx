import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '../../design/primitives';
import { LinkShare } from '../../components/share/LinkShare';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { FamilyLink } from './familyLinks';

/**
 * A family link ready to send in any chat: it is made (or the open one fetched again) when shown, then the usual
 * QR, Copy, WhatsApp and Share. The same link comes back each time until someone uses it.
 */
export function FamilyLinkShare({ load, title, subtitle, message, label }: {
    load: () => Promise<FamilyLink>; title: string; subtitle: string; message: string; label: string;
}) {
    const copy = useJourneyCopy();
    const [link, setLink] = useState<FamilyLink | null>(null);
    const [failed, setFailed] = useState(false);
    const [error, setError] = useState('');
    const [round, setRound] = useState(0);
    useEffect(() => {
        let live = true;
        setFailed(false);
        load().then(made => { if (live) setLink(made); }).catch(() => { if (live) setFailed(true); });
        return () => { live = false; };
        // `load` is a new function each render; the round is what asks again.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [round]);
    if (failed) return <div className="flex flex-col gap-2" role="alert">
        <p className="text-sm">{copy("The link couldn't be made.", 'ბმული ვერ შეიქმნა.')}</p>
        <Button onClick={() => setRound(r => r + 1)}>{copy('Try again', 'ხელახლა')}</Button>
    </div>;
    if (!link) return <Loader2 className="mx-auto h-6 w-6 animate-spin" aria-label={copy('Making the link', 'ბმული იქმნება')} />;
    return <>
        <LinkShare url={`${window.location.origin}${link.path}`} title={title} subtitle={subtitle} message={message} label={label} onError={setError} />
        {error && <p role="alert" className="mt-2 text-sm">{error}</p>}
    </>;
}
