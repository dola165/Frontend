import { useEffect, useState } from 'react';
import { Dialog } from '../../design/Dialog';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { ago } from '../teamWork/teamWorkWords';
import { fetchMissed, type MissedSearch, type SearchHit } from './api';
import { fileName } from './searchWords';

/** What search missed, newest first: the words, who and when, and what they opened instead. For the team. */
export function MissedList({ onClose, onOpen }: { onClose: () => void; onOpen: (hit: SearchHit) => void }) {
    const copy = useJourneyCopy();
    const [rows, setRows] = useState<MissedSearch[] | null>(null);
    const [error, setError] = useState(false);
    useEffect(() => {
        const controller = new AbortController();
        fetchMissed(controller.signal).then(found => { if (!controller.signal.aborted) setRows(found); })
            .catch(() => { if (!controller.signal.aborted) setError(true); });
        return () => controller.abort();
    }, []);
    const title = (hit: SearchHit) => hit.file ? fileName(copy, hit.file, hit.title) : hit.where.key ? `${hit.where.key} ${hit.title ?? ''}` : hit.title ?? '—';
    return <Dialog open size="md" className="tw-search-missed" title={copy('What search missed', 'რა ვერ იპოვა ძიებამ')} onClose={onClose} closeLabel={copy('Close', 'დახურვა')}
        description={copy('Each “Not what I was looking for”, with what the person opened instead.', 'ყოველი „ეს არ არის, რასაც ვეძებდი“ და ის, რაც ამის მერე გახსნეს.')}>
        {error && <p className="gk-notice gk-notice--danger" role="alert">{copy('The list could not load.', 'სია ვერ ჩაიტვირთა.')}</p>}
        {!rows && !error && <p className="gk-faint" role="status">{copy('Loading…', 'იტვირთება…')}</p>}
        {rows && !rows.length && <p className="gk-faint">{copy('Nothing yet: search found what everyone looked for.', 'ჯერ არაფერი: ძიებამ ყველაფერი იპოვა.')}</p>}
        {rows && rows.length > 0 && <ul className="tw-search-missed__list">
            {rows.map(row => <li key={row.id}>
                <span className="tw-search-missed__query">“{row.query}”</span>
                <span className="gk-faint">{row.by.name ?? '—'} · {ago(copy, row.at)}</span>
                {row.opened
                    ? <span>{copy('Opened instead:', 'ამის ნაცვლად გახსნა:')} <button type="button" className="tw-link-button" onClick={() => { if (row.opened) onOpen(row.opened); }}>{title(row.opened)}</button></span>
                    : <span className="gk-faint">{row.openedAt ? copy('Opened something you can’t open', 'გახსნა ის, რაც თქვენ არ გეხსნებათ') : copy('Nothing opened after', 'შემდეგ არაფერი გაუხსნია')}</span>}
            </li>)}
        </ul>}
    </Dialog>;
}
