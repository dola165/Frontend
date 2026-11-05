import { useCallback, useEffect, useState } from 'react';
import { accessibleClubs } from '../../../components/layout/clubAccess';
import { useAuth } from '../../../context/AuthContext';
import { Button, Skeleton } from '../../../design/primitives';
import { fetchMyPages, type MyPage } from '../../pages/api';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { fetchClubProfile } from '../../world/api';
import { Crest } from '../../world/Crest';
import { WelcomeFrame, type WelcomeStepProps } from '../WelcomeFrame';
import { FindClub, type FoundClub } from './club/FindClub';
import { StartClub } from './club/StartClub';
import './club/club-step.css';

interface YourClubInfo { id: number; name: string; crestUrl: string | null; draft: boolean }

/**
 * Step 2 of A club (owner, 27 October): it is starting a club. Name, town (filled in) and colours, then Start my club.
 * One grey line, "Already in a club?", turns it into a search by name with Join (an invite is accepted; otherwise the
 * code from the admin's staff link); the search is in the address (`part=find`), so Back returns to starting. Someone
 * who already has a club (a staff job there, or a club page of their own, a draft included) sees that club with Open.
 */
export function ClubStep(props: WelcomeStepProps) {
    const copy = useJourneyCopy();
    const { user } = useAuth();
    // Staff means one club (release 7): a job there, not following or playing. A draft club the person started is
    // theirs too, though it is not in the navigation yet, so their own pages are asked for as well.
    const staffAt = accessibleClubs(user?.navigationCapabilities).find(club => club.relationships.some(relation => relation === 'Club staff' || relation === 'Club appointment')) ?? null;
    const [pages, setPages] = useState<MyPage[] | 'failed' | null>(null);
    const [round, setRound] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        fetchMyPages(controller.signal).then(setPages, () => { if (!controller.signal.aborted) setPages('failed'); });
        return () => controller.abort();
    }, [round]);
    const retry = useCallback(() => { setPages(null); setRound(value => value + 1); }, []);
    // What was typed carries over: the name searched for becomes the club to start, and the other way round.
    const [carry, setCarry] = useState<{ name: string; club: FoundClub | null }>({ name: '', club: null });

    const page = Array.isArray(pages) ? pages.find(item => item.kind === 'CLUB' && item.clubId != null) : undefined;
    const yours: YourClubInfo | null = page ? { id: page.clubId!, name: page.name, crestUrl: page.crestUrl, draft: page.status === 'DRAFT' }
        : staffAt ? { id: staffAt.id, name: staffAt.name, crestUrl: null, draft: false } : null;
    if (yours) return <YourClub club={yours} {...props} />;
    // Asked before anything can be typed, so a club of their own never replaces a name half written.
    if (pages === null) return <WelcomeFrame position={2} size="choose" onClose={props.close} back={props.back} title={copy('A club', 'კლუბი')} footer={null}>
        <div role="status" aria-label={copy('Loading', 'იტვირთება')}><Skeleton height={220} /></div>
    </WelcomeFrame>;
    return props.part === 'find'
        ? <FindClub {...props} query={carry.name} chosen={carry.club} onStart={name => { setCarry({ name, club: null }); props.openPart(null); }} />
        : <StartClub {...props} name={carry.name} checkFailed={pages === 'failed' ? retry : null}
            onFind={(name, club = null) => { setCarry({ name, club }); props.openPart('find'); }} />;
}

function YourClub({ club, land, back, close }: WelcomeStepProps & { club: YourClubInfo }) {
    const copy = useJourneyCopy();
    // A staff job carries no crest: the club's own profile has it.
    const [crest, setCrest] = useState(club.crestUrl);
    useEffect(() => {
        if (club.crestUrl) return;
        const controller = new AbortController();
        fetchClubProfile(club.id, controller.signal).then(profile => { if (!controller.signal.aborted) setCrest(profile.logoUrl ?? null); }, () => undefined);
        return () => controller.abort();
    }, [club.crestUrl, club.id]);
    return <WelcomeFrame position={2} size="choose" onClose={close} back={back} title={copy('Your club', 'თქვენი კლუბი')}
        footer={<Button variant="primary" onClick={() => land('club', `/clubs/${club.id}`)}>{copy('Open', 'გახსნა')}</Button>}>
        <div className="gk-wjoin__row gk-wjoin__row--own">
            <Crest src={crest} name={club.name} size={56} />
            <span className="gk-wjoin__text"><strong>{club.name}</strong>
                <small>{club.draft ? copy('Draft · only you see it', 'მონახაზი · მხოლოდ თქვენ ხედავთ') : copy('You’re on the staff here.', 'აქ შტატში ხართ.')}</small></span>
        </div>
    </WelcomeFrame>;
}
