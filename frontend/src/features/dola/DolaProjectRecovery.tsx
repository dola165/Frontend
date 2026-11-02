import { Link } from 'react-router-dom';
import { useDola } from './DolaContext';
import { safeDolaDestination } from './api';
import './project-recovery.css';

export function DolaProjectRecovery() {
    const { projectRecovery, busy } = useDola();
    const { operation, outcome, checking, message, check } = projectRecovery;
    if (!operation && !outcome) return null;
    return <section className="dola-project-recovery" aria-label="Project operation result">
        {operation ? <>
            <h3>Check the project change</h3>
            <p role="status">{message || 'A previous request has no confirmed result yet. Check its receipt before making another change.'}</p>
            <p className="dola-operation-id">Operation: {operation.operationId}</p>
            <button type="button" disabled={checking || busy} onClick={() => void check()}>{checking ? 'Checking result…' : 'Check result'}</button>
        </> : outcome && <>
            <h3>{outcome.state === 'COMPLETED' ? 'Project change recorded' : 'Review was not completed'}</h3>
            <p role="status">{outcome.receipt}</p>
            {outcome.state === 'PENDING' && <p>Continue the chat to review the same proposal before confirming or discarding it.</p>}
            <dl>{outcome.context.map(detail => <div key={detail.label}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl>
            {outcome.destination && safeDolaDestination(outcome.destination) && <Link to={outcome.destination.path}>View current project and history</Link>}
        </>}
    </section>;
}
