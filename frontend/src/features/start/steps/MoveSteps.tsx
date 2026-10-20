import type { CSSProperties } from 'react';
import { ArrowRight, MapPin, Trophy } from 'lucide-react';
import { AddChild } from '../../parents/AddChild';
import { createHref } from '../../pages/create/entry';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import type { StepProps } from '../WelcomeDialog';

/** Parent: the child flow from Parent Hub, beside a picture; once the child is added the welcome goes on. */
export function ChildStep({ next }: StepProps) {
    return <div className="gk-welcome__split">
        <div className="gk-welcome__split-form"><AddChild inline onCreated={() => next()} /></div>
        <div className="gk-welcome__split-picture" aria-hidden="true" style={{ '--move-photo': 'url(/landing/after-the-whistle.jpg)' } as CSSProperties} />
    </div>;
}

/**
 * Organizer or venue manager: one big picture into the existing flow. A tournament starts in the Draw room; a venue
 * starts as a page, whose settings switch the venue on (venues have no page type of their own yet).
 */
export function MoveStep({ kind, leave }: StepProps & { kind: 'tournament' | 'venue' }) {
    const copy = useJourneyCopy();
    const tile = kind === 'tournament'
        ? { icon: Trophy, photo: '/football/touchline.jpg', label: copy('Create a tournament', 'შექმენით ტურნირი'), hint: copy('Teams, fixtures and results in one place', 'გუნდები, მატჩები და შედეგები ერთად'), to: '/tournaments/setup' }
        : { icon: MapPin, photo: '/venue-demo/pitch-aerial.jpg', label: copy('Add your venue', 'დაამატეთ თქვენი მოედანი'), hint: copy('Start with its page', 'დაიწყეთ მისი გვერდით'), to: createHref({ pathname: '/home', search: '' }, 'PAGE', 'start') };
    return <button type="button" className="gk-welcome__move" data-kind={kind} style={{ '--move-photo': `url(${tile.photo})` } as CSSProperties} onClick={() => leave(tile.to)}>
        <span className="gk-welcome__move-icon"><tile.icon aria-hidden="true" /></span>
        <span className="gk-welcome__text"><strong>{tile.label}</strong><small>{tile.hint}</small></span>
        <ArrowRight className="gk-welcome__move-arrow" aria-hidden="true" />
    </button>;
}
