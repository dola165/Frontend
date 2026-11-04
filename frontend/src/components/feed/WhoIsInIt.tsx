import { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { apiClient } from '../../api/axiosConfig';
import { Avatar } from '../../design/primitives';
import { useJourneyCopy } from '../../features/squadCommunication/journeyCopy';
import { NOT_ANSWERED, type PhotoAnswer } from './photoAnswer';
import './post-composer.css';

interface Face { id: number; name: string; squadId: number; squadName: string; yes: boolean }
interface Question { ask: boolean; clubId: number | null; people: Face[] }

/**
 * "Who's in it?" under a photo: the faces of the squad, each showing whether their family has said yes, or "No children in
 * it". Nobody has to answer: the line under it says who will see the photo, whatever is chosen. Only the server decides
 * whether to ask, for a club with children or an adult who works or plays at one; for adult football it shows nothing.
 */
export function WhoIsInIt({ clubId, squadId, answer, onAnswer, caption = '' }: { clubId?: number | null; squadId?: number | null; answer: PhotoAnswer; onAnswer: (next: PhotoAnswer) => void; caption?: string }) {
    const copy = useJourneyCopy();
    const author = `${clubId ?? ''}:${squadId ?? ''}`;
    const [found, setFound] = useState<{ author: string; question: Question } | null>(null);
    const question = found?.author === author ? found.question : null;
    const [squad, setSquad] = useState<number | null>(null);
    useEffect(() => {
        const abort = new AbortController();
        Promise.resolve(apiClient.get<Question>('/posts/photo-question', { params: { ...(clubId ? { clubId } : {}), ...(squadId ? { squadId } : {}) }, signal: abort.signal }))
            .then(response => { if (!abort.signal.aborted && response?.data) setFound({ author, question: response.data }); })
            .catch(() => { /* The server still keeps an unanswered photo with the squad. */ });
        return () => abort.abort();
    }, [author, clubId, squadId]);
    const squads = useMemo(() => [...new Map((question?.people ?? []).map(face => [face.squadId, face.squadName])).entries()], [question]);
    if (!question?.ask) return null;
    const faces = squad ? question.people.filter(face => face.squadId === squad) : question.people;
    const named = question.people.filter(face => answer.people.includes(face.id));
    const waiting = named.filter(face => !face.yes).length;
    const toggle = (id: number) => {
        const people = answer.people.includes(id) ? answer.people.filter(person => person !== id) : [...answer.people, id];
        onAnswer(people.length ? { children: 'NAMED', people } : NOT_ANSWERED);
    };
    const inCaption = named.find(face => { const first = face.name.trim().split(/\s+/)[0]; return first.length > 1 && caption.toLowerCase().includes(first.toLowerCase()); });
    const outcome = answer.children === 'NONE' ? copy('The club’s followers can see this photo.', 'ამ ფოტოს კლუბის გამომწერები ნახავენ.')
        : answer.children === 'NAMED' && !waiting ? copy('Every family said yes. The club’s followers can see this photo.', 'ყველა ოჯახი დათანხმდა. ამ ფოტოს კლუბის გამომწერები ნახავენ.')
        : answer.children === 'NAMED' ? copy(`Only the squad’s families and staff see it until ${waiting} more ${waiting === 1 ? 'family says' : 'families say'} yes.`, `ფოტოს მხოლოდ გუნდის ოჯახები და პერსონალი ნახავენ, სანამ კიდევ ${waiting} ოჯახი არ დათანხმდება.`)
        : copy('Not answered: only the squad’s families and staff see this photo.', 'პასუხი არ არის: ამ ფოტოს მხოლოდ გუნდის ოჯახები და პერსონალი ნახავენ.');
    return <fieldset className="who-in-it">
        <legend>{copy('Who’s in it?', 'ვინ არის ფოტოზე?')}</legend>
        <button type="button" className="who-in-it__none" aria-pressed={answer.children === 'NONE'} onClick={() => onAnswer(answer.children === 'NONE' ? NOT_ANSWERED : { children: 'NONE', people: [] })}>{copy('No children in it', 'ფოტოზე ბავშვები არ არიან')}</button>
        {squads.length > 1 && <label className="who-in-it__squad"><span className="sr-only">{copy('Squad', 'გუნდი')}</span>
            <select value={squad ?? ''} onChange={event => setSquad(Number(event.target.value) || null)}>
                <option value="">{copy('All squads', 'ყველა გუნდი')}</option>
                {squads.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select></label>}
        {faces.length > 0 && <ul className="who-in-it__faces">{faces.map(face => {
            const on = answer.people.includes(face.id);
            return <li key={face.id}><button type="button" aria-pressed={on} title={face.yes ? copy('Their family said yes', 'ოჯახი დათანხმდა') : copy('No yes from their family yet', 'ოჯახის თანხმობა ჯერ არ არის')} onClick={() => toggle(face.id)}>
                <Avatar name={face.name} size={32} />
                <span>{face.name.trim().split(/\s+/)[0]}</span>
                {face.yes && <Check aria-label={copy('Their family said yes', 'ოჯახი დათანხმდა')} />}
            </button></li>;
        })}</ul>}
        <p className="who-in-it__outcome" role="status">{outcome}</p>
        {inCaption && <p className="who-in-it__warn">{copy(`The caption names ${inCaption.name.trim().split(/\s+/)[0]}. Better no name beside a child’s photo.`, `წარწერაში სახელია: ${inCaption.name.trim().split(/\s+/)[0]}. ბავშვის ფოტოსთან სჯობს სახელი არ ეწეროს.`)}</p>}
    </fieldset>;
}
