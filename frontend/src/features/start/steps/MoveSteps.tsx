import { ArrowRight, MapPin, Trophy } from 'lucide-react';
import { AddChild } from '../../parents/AddChild';
import { createHref } from '../../pages/create/entry';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import type { StepProps } from '../WelcomeDialog';

/** Parent: the child flow from Parent Hub, right here; once the child is added the welcome goes on. */
export function ChildStep({ next }: StepProps) {
    return <AddChild inline onCreated={() => next()} />;
}

/**
 * Organizer or venue manager: one tile into the existing flow. A tournament starts in the Draw room; a venue starts
 * as a page, whose settings switch the venue on (venues have no page type of their own yet).
 */
export function MoveStep({ kind, leave }: StepProps & { kind: 'tournament' | 'venue' }) {
    const copy = useJourneyCopy();
    const tile = kind === 'tournament'
        ? { icon: Trophy, label: copy('Create a tournament', 'შექმენით ტურნირი'), hint: copy('Teams, fixtures and results in one place', 'გუნდები, მატჩები და შედეგები ერთად'), to: '/tournaments/setup' }
        : { icon: MapPin, label: copy('Add your venue', 'დაამატეთ თქვენი მოედანი'), hint: copy('Start with its page', 'დაიწყეთ მისი გვერდით'), to: createHref({ pathname: '/home', search: '' }, 'PAGE', 'start') };
    return <button type="button" className="gk-welcome__move" data-kind={kind} onClick={() => leave(tile.to)}>
        <span className="gk-welcome__move-icon"><tile.icon aria-hidden="true" /></span>
        <span className="gk-welcome__text"><strong>{tile.label}</strong><small>{tile.hint}</small></span>
        <ArrowRight className="gk-welcome__move-arrow" aria-hidden="true" />
    </button>;
}
