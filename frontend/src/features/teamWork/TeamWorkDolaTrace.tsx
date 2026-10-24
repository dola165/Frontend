import type { AgentDolaTrace } from '../dola/agentDola';
import type { useJourneyCopy } from '../squadCommunication/journeyCopy';

type Copy = ReturnType<typeof useJourneyCopy>;
const two = (value: number) => value.toFixed(2);

/**
 * "How Dola understood this", folded under a reply: the route and its confidence, the details read from the message,
 * the Jev and writer calls, the time, and why Dola asked or refused. For team members testing Dola; the server sends
 * it only when asked and never with other people's data.
 */
export function DolaTrace({ trace, copy }: { trace: AgentDolaTrace; copy: Copy }) {
    return <details className="tw-dola__trace">
        <summary>{copy('How Dola understood this', 'როგორ გაიგო დოლამ')}</summary>
        <dl>
            <div><dt>{copy('Route', 'მიმართულება')}</dt><dd>
                <code>{trace.route ?? copy('none', 'არცერთი')}</code>
                {trace.confidence !== null && <> · {two(trace.confidence)}</>}
                {trace.runnerUp && <> · {copy('next', 'შემდეგი')} <code>{trace.runnerUp}</code></>}
            </dd></div>
            {trace.direct !== null && <div><dt>{copy('Instruction', 'ბრძანება')}</dt><dd>{two(trace.direct)}</dd></div>}
            <div><dt>{copy('Details read', 'ამოკითხული')}</dt><dd>{trace.slots.length === 0 ? copy('none', 'არაფერი')
                : <ul>{trace.slots.map(slot => <li key={slot.name}><code>{slot.name}</code> {slot.value}</li>)}</ul>}</dd></div>
            <div><dt>{copy('Calls', 'გამოძახებები')}</dt><dd>{copy(`${trace.jevCalls} Jev · ${trace.writerCalls} writer · ${trace.millis} ms`,
                `${trace.jevCalls} Jev · ${trace.writerCalls} writer · ${trace.millis} მწ`)}</dd></div>
            {trace.why && <div><dt>{copy('Why', 'რატომ')}</dt><dd>{trace.why}</dd></div>}
        </dl>
    </details>;
}
