import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../../../design/primitives';
import { FamilyMoneyHistory } from '../../parents/hub/FamilyMoneyHistory';
import './money.css';

export interface MoneyConnection { club_id: number; club_name: string; user_id: number; name: string }

/** One entry per current family/self connection, independent of the mixed record feed cap. */
export function FamilyMoneyConnections({ connections, revision }: { connections: MoneyConnection[]; revision: number }) {
    const [params, setParams] = useSearchParams(), [revisit, setRevisit] = useState(0);
    useEffect(() => {
        const refresh = () => { if (document.visibilityState === 'visible') setRevisit(v => v + 1); };
        document.addEventListener('visibilitychange', refresh);
        return () => document.removeEventListener('visibilitychange', refresh);
    }, []);
    const selected = connections.find(c => `${c.club_id}:${c.user_id}` === params.get('moneyFor'));
    const choose = (value: string) => { const next = new URLSearchParams(params); next.set('moneyFor', value); setParams(next); };
    if (!connections.length) return null;
    return <section className="club-money" aria-label="Family and player money">
        <h3>Money</h3>
        <div className="club-money__connections">{connections.map(c => <Button key={`${c.club_id}:${c.user_id}`} aria-pressed={selected === c}
            onClick={() => choose(`${c.club_id}:${c.user_id}`)}>Money: {c.name} · {c.club_name}</Button>)}</div>
        {selected && <section aria-label={`Money for ${selected.name}`}><h4>{selected.name} · {selected.club_name}</h4>
            <FamilyMoneyHistory club={selected.club_id} child={selected.user_id} revision={`${revision}:${revisit}`} /></section>}
    </section>;
}
