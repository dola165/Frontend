import { label } from '../api';
import { moneyText, type MoneyRecord } from './api';
import './money.css';

export function MoneyHistory({ record }: { record: MoneyRecord }) {
    const b = record.balance;
    return <div className="club-money gk-stack gk-stack--tight">
        <dl className="club-money__balance">
            <div><dt>Agreed dues</dt><dd>{moneyText(b.agreed, b.currency)}</dd></div>
            <div><dt>Outside receipts</dt><dd>{moneyText(b.received, b.currency)}</dd></div>
            <div><dt>Waived</dt><dd>{moneyText(b.waived, b.currency)}</dd></div>
            <div><dt>Remaining</dt><dd><strong>{moneyText(b.remaining, b.currency)}</strong></dd></div>
        </dl>
        <p className="gk-muted">{label(b.status)}{record.dueOn ? ` · Due ${record.dueOn}` : ''}{b.reminderCandidate ? ' · Due for a reminder' : ''}</p>
        <details><summary>Receipts and corrections · {record.history.length}</summary>
            {record.history.length ? <ol className="club-money__history">{record.history.map(f => <li key={f.id}>
                <strong>{label(f.type)}{f.type !== 'CORRECTION' ? ` · ${moneyText(f.amount, f.currency)}` : f.reverses === 0 ? ' · reverses earlier recorded settlement' : ` · reverses #${f.reverses}`}</strong>
                <span>{f.happenedOn}{f.reference ? ` · ${f.reference}` : ''} · #{f.id}</span><p>{f.reason}</p>
            </li>)}</ol> : <p className="gk-muted">No outside facts recorded here. Earlier settled instalments keep the club’s recorded status.</p>}
        </details>
    </div>;
}
