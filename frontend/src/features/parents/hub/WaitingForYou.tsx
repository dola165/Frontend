import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import type { WaitingItem } from './childFacts';
import './parent-hub.css';

/**
 * "Waiting for you": only what truly waits on the parent (an update to read, a place offered, a payment due, a consent
 * the law asks for). A dot in front, the step in words, an arrow behind; nothing shows when nothing waits.
 */
export function WaitingForYou({ items }: { items: WaitingItem[] }) {
    const copy = useJourneyCopy();
    if (!items.length) return null;
    return <section className="ph-waiting" aria-label={copy('Waiting for you', 'გელოდებათ')} data-guide="waiting">
        <h2 className="ph-eyebrow">{copy('Waiting for you', 'გელოდებათ')}</h2>
        <ul className="ph-rows">
            {items.map(item => <li key={item.key}><Link className="ph-row" to={item.to}>
                <span className={`ph-dot ph-dot--${item.tone}`} aria-hidden="true" />
                <span className="ph-row__text"><strong>{item.text}</strong><small>{item.detail}</small></span>
                <span className={`ph-step ph-step--${item.tone}`}>{item.action}</span>
                <ArrowRight aria-hidden="true" />
            </Link></li>)}
        </ul>
    </section>;
}
