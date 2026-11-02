import { useState } from 'react';
import { Send } from 'lucide-react';
import { clubCardFamilyLink } from '../../parents/familyLinks';
import { FamilyLinkShare } from '../../parents/FamilyLinkShare';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { Avatar, Button, List, ListRow, Section } from '../../../design/primitives';
import { Dialog } from '../../../design/Dialog';
import type { CoachData } from './CoachWorkspace';
import { useWaitingCards, type Waiting } from './useWaitingCards';

/**
 * "Waiting for the family" on My squads › Players: a child's card made for the squad joins it when a parent opens its
 * link and says yes. Until then it stays here, with the same card's link to send again, so nobody makes the card twice.
 */
export function WaitingForFamily({ data }: { data: CoachData }) {
    const say = useJourneyCopy();
    const cards = useWaitingCards(data.clubId, data.shown, data.revision);
    const [sending, setSending] = useState<Waiting | null>(null);
    if (!cards.length) return null;
    const several = data.shown.length > 1;
    const first = (name: string) => name.trim().split(/\s+/)[0];
    return <Section boxed title={say('Waiting for the family', 'ოჯახის პასუხს ელოდება')} hint={`${cards.length}`}>
        <List label={say('Waiting for the family', 'ოჯახის პასუხს ელოდება')}>
            {cards.map(card => <ListRow key={card.cardId} lead={<Avatar name={card.fullName} size={32} />} title={card.fullName}
                meta={[say(`Born ${card.birthYear}`, `დაბ. ${card.birthYear}`), several ? data.names.get(card.squad) : null].filter(Boolean).join(' · ')}
                trail={<Button size="sm" onClick={() => setSending(card)}><Send aria-hidden="true" />{say('Send again', 'ხელახლა გაგზავნა')}</Button>} />)}
        </List>
        <Dialog open={sending != null} onClose={() => setSending(null)} title={say('Send to the family', 'ოჯახისთვის გაგზავნა')}
            description={sending ? say(`${first(sending.fullName)} joins ${data.names.get(sending.squad) ?? 'the squad'} when the family opens this link and says yes.`,
                `${first(sending.fullName)} ${data.names.get(sending.squad) ?? 'გუნდს'} შეუერთდება, როცა ოჯახი ამ ბმულს გახსნის და თანხმობას მისცემს.`) : undefined}>
            {sending && <FamilyLinkShare load={() => clubCardFamilyLink(data.clubId, sending.userId)}
                title={say(`${first(sending.fullName)}’s card`, `${first(sending.fullName)}-ის ბარათი`)} subtitle={say('Open it to be their parent here', 'გახსენით, რომ აქ მისი მშობელი იყოთ')}
                message={say(`Here is ${first(sending.fullName)}’s card from our club. Open it so you’re ${first(sending.fullName)}’s parent on GrassKickZ.`,
                    `ეს არის ${first(sending.fullName)}-ის ბარათი ჩვენი კლუბიდან. გახსენით, რომ GrassKickZ-ზე ${first(sending.fullName)}-ის მშობელი იყოთ.`)}
                label={say(`Link for ${first(sending.fullName)}’s family`, `ბმული ${first(sending.fullName)}-ის ოჯახისთვის`)} />}
        </Dialog>
    </Section>;
}
