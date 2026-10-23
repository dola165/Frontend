import { Pin, PinOff } from 'lucide-react';
import { Button } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { PinTarget, Pins } from './usePins';

/** Pin or unpin, like the app's other pin toggles: its name stays "Pin …" and the pressed state says whether it is. */
export function PinButton({ pins, target, name, withLabel = false }: { pins: Pins; target: PinTarget; name: string; withLabel?: boolean }) {
    const copy = useJourneyCopy();
    const on = pins.pinned(target);
    const blocked = !on && pins.full;
    return <Button size="sm" variant={on ? 'secondary' : 'ghost'} iconOnly={!withLabel} aria-pressed={on} aria-label={copy(`Pin ${name}`, `მიმაგრება: ${name}`)} disabled={blocked} className="tw-pin"
        title={blocked ? copy('Your pins are full. Unpin something first.', 'მიმაგრებები სავსეა. ჯერ რამე მოხსენით.') : on ? copy('Pinned to your overview', 'მიმაგრებულია თქვენს მიმოხილვაზე') : copy('Pin to your overview', 'მიმოხილვაზე მიმაგრება')}
        onClick={() => void pins.toggle(target)}>
        <Pin aria-hidden="true" />{withLabel && <span>{on ? copy('Pinned', 'მიმაგრებულია') : copy('Pin', 'მიმაგრება')}</span>}
    </Button>;
}

/** The quiet unpin control in the pinned list. */
export function UnpinButton({ pins, target, name }: { pins: Pins; target: PinTarget; name: string }) {
    const copy = useJourneyCopy();
    return <Button size="sm" variant="ghost" iconOnly aria-label={copy(`Unpin ${name}`, `მოხსნა: ${name}`)} title={copy('Unpin', 'მოხსნა')} onClick={() => void pins.toggle(target)}><PinOff aria-hidden="true" /></Button>;
}
