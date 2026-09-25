import { SessionDialog } from './SquadSessionDialog';
import { useJourneyCopy } from './journeyCopy';
import './journey-actions.css';

export function ScheduleCreationChoice({ onClose, onSession, onClubEvent }: { onClose: () => void; onSession: () => void; onClubEvent: (weekly: boolean) => void }) {
    const copy = useJourneyCopy();
    return <SessionDialog title={copy('Choose a scheduling option', 'აირჩიეთ დაგეგმვის ვარიანტი')} onClose={onClose}>
        <div className="journey-create-choice">
            <div><button onClick={onSession}>{copy('Family session', 'ოჯახის სესია')}</button><p>{copy('One private session with a fixed invitation list, family replies, change notices and cancellation history.', 'ერთი პირადი სესია ფიქსირებული მოწვევებით, ოჯახის პასუხებით, ცვლილების შეტყობინებებითა და გაუქმების ისტორიით.')}</p></div>
            <div><button onClick={() => onClubEvent(true)}>{copy('Weekly club calendar training', 'კლუბის კალენდრის ყოველკვირეული ვარჯიში')}</button><p>{copy('Repeats in the club calendar. It does not invite families or collect replies, and private entries may be unavailable to parents. Create individual family sessions when you need confirmations.', 'მეორდება კლუბის კალენდარში. არ აგზავნის ოჯახის მოწვევებს და არ აგროვებს პასუხებს; პირადი ჩანაწერები შესაძლოა მშობლებისთვის მიუწვდომელი იყოს. დასტურის მისაღებად შექმენით ცალკეული ოჯახის სესიები.')}</p></div>
            <div><button onClick={() => onClubEvent(false)}>{copy('Other club calendar event', 'კლუბის კალენდრის სხვა ღონისძიება')}</button><p>{copy('Uses ordinary club visibility and event tools. It does not include the family session reply workflow.', 'იყენებს კლუბის ხილვადობასა და ღონისძიების ხელსაწყოებს. ოჯახის სესიის პასუხების ფუნქციას არ მოიცავს.')}</p></div>
        </div>
    </SessionDialog>;
}
