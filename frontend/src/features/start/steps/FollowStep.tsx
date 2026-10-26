import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '../../../design/primitives';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { ClubPicker } from '../ClubPicker';
import { fetchClubsNearYou, followClubs, type NearbyClub } from '../startApi';
import { WelcomeFrame, type WelcomeStepProps } from '../WelcomeFrame';

/** Step 2 of "I'm here to follow football": clubs near the person, the three nearest already ticked; then Home. */
export function FollowStep({ land, back, close }: WelcomeStepProps) {
    const copy = useJourneyCopy();
    const [clubs, setClubs] = useState<NearbyClub[] | null>(null);
    const [chosen, setChosen] = useState<Set<number>>(new Set());
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        const controller = new AbortController();
        fetchClubsNearYou(12, 'NEAREST', controller.signal)
            .then(found => { if (controller.signal.aborted) return; setClubs(found); setChosen(new Set(found.slice(0, 3).map(club => club.id))); })
            .catch(() => { if (!controller.signal.aborted) setClubs([]); });
        return () => controller.abort();
    }, []);
    const toggle = (id: number) => setChosen(current => { const next = new Set(current); if (!next.delete(id)) next.add(id); return next; });
    const finish = async () => {
        setBusy(true); setFailed(false);
        const missed = await followClubs((clubs ?? []).filter(club => chosen.has(club.id)));
        setBusy(false);
        if (missed) setFailed(true); else land('follow', null);
    };
    const count = chosen.size;
    return <WelcomeFrame position={2} onClose={close} back={back} title={copy('Clubs near you', 'კლუბები თქვენთან ახლოს')}
        hint={copy('Their news comes to Home.', 'მათი სიახლეები მთავარ გვერდზე გამოჩნდება.')}
        footer={<Button variant="primary" disabled={busy || !clubs} onClick={() => void finish()}>
            {busy && <Loader2 className="gk-welcome__spin" aria-hidden="true" />}
            {count ? copy(`Follow ${count} ${count === 1 ? 'club' : 'clubs'}`, `${count} კლუბის გამოწერა`) : copy('Done', 'მზადაა')}
        </Button>}>
        <ClubPicker clubs={clubs} chosen={chosen} onToggle={toggle} label={copy('Clubs to follow', 'გამოსაწერი კლუბები')}
            empty={copy('No clubs near you yet.', 'თქვენთან ახლოს კლუბები ჯერ არ არის.')} />
        {failed && <p role="alert" className="gk-notice gk-notice--warning">{copy('Some follows did not go through. Try again.', 'ზოგი გამოწერა ვერ შესრულდა. სცადეთ ხელახლა.')}</p>}
    </WelcomeFrame>;
}
