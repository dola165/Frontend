import { useEffect, useId, useState } from 'react';
import { Button, Field } from '../../../design/primitives';
import { getAuthSessionId, isCurrentAuthSession } from '../../../utils/authStorage';
import { get, root, type Choice } from '../api';
import './records.css';
import './record-choice-picker.css';

interface Props { club: number; forKind: string; target: 'ASSET' | 'FACILITY' | 'PERSON'; squad: string; value: string; selected?: Choice; onChange: (id: string) => void; disabled?: boolean; required?: boolean; label: string }
interface Page { items: Choice[]; page: number; hasMore: boolean }

/** A scoped search, not a filter over the capped bootstrap list. Selection survives search/page changes. */
export function RecordChoicePicker(props: Props) {
    return <Choices key={`${props.club}:${props.forKind}:${props.target}:${props.squad}:${getAuthSessionId()}`} {...props} />;
}
function Choices({ club, forKind, target, squad, value, selected, onChange, disabled, required, label }: Props) {
    const id = useId(), [session] = useState(getAuthSessionId);
    const [q, setQ] = useState(''), [page, setPage] = useState(0), [retry, setRetry] = useState(0);
    const key = `${q}:${page}:${retry}`;
    const [result, setResult] = useState<{ key: string; data?: Page; error?: boolean } | null>(null);
    const [retained, setRetained] = useState<Choice | undefined>(selected);
    useEffect(() => {
        if (disabled) return;
        const c = new AbortController();
        const query = new URLSearchParams({ forKind, target, q, page: String(page) });
        if (squad) query.set('squad', squad);
        void get<Page>(`${root(club)}/record-choices?${query}`, c.signal).then(data => {
            if (!c.signal.aborted && isCurrentAuthSession(session)) setResult({ key, data });
        }).catch(() => { if (!c.signal.aborted && isCurrentAuthSession(session)) setResult({ key, error: true }); });
        return () => c.abort();
    }, [club, forKind, target, squad, q, page, key, session, disabled]);
    const current = result?.key === key ? result : null;
    const rows = current?.data?.items ?? [];
    const chosen = rows.find(c => String(c.id) === value) ?? (retained && String(retained.id) === value ? retained : selected && String(selected.id) === value ? selected : undefined);
    const options = chosen && !rows.some(c => c.id === chosen.id) ? [chosen, ...rows] : rows;
    return <div className="rec-choice-picker gk-stack gk-stack--tight">
        {!disabled && <Field label={`Search ${label.toLowerCase()}`} htmlFor={`${id}-search`}><input id={`${id}-search`} className="gk-input" type="search" maxLength={100} value={q} onChange={e => { setQ(e.target.value); setPage(0); }} /></Field>}
        <Field label={label} htmlFor={id}><select id={id} className="gk-input" required={required} disabled={disabled} value={value} onChange={e => { setRetained(options.find(c => String(c.id) === e.target.value)); onChange(e.target.value); }}>
            <option value="">{required ? 'Choose' : 'Unassigned'}</option>{options.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select></Field>
        {!disabled && (!current ? <p role="status">Loading choices…</p> : current.error ? <div role="alert">Choices could not load. <Button onClick={() => setRetry(v => v + 1)}>Retry choices</Button></div> : <>
            <p className="gk-muted">Page {page + 1}{current.data?.hasMore ? ' · More choices available; search or continue.' : ' · All matching choices on these pages.'}</p>
            <div className="rec-transitions"><Button disabled={page === 0} onClick={() => setPage(v => v - 1)}>Previous choices</Button><Button disabled={!current.data?.hasMore} onClick={() => setPage(v => v + 1)}>More choices</Button></div>
        </>)}
    </div>;
}
