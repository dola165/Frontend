import { useCallback, useEffect, useState } from 'react';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { addPin, fetchPins, removePin, type WorkPin } from './overviewApi';

export const MAX_PINS = 20;
export type PinTarget = { planId: number } | { itemId: number };
const same = (pin: WorkPin, target: PinTarget) => 'planId' in target ? pin.planId === target.planId : pin.itemId === target.itemId;

/** Your own pins: plans and tasks kept on top of your Overview, saved with your account. */
export function usePins(revision: number) {
    const copy = useJourneyCopy();
    const [pins, setPins] = useState<WorkPin[]>([]);
    const [error, setError] = useState('');
    useEffect(() => {
        const controller = new AbortController();
        fetchPins(controller.signal).then(next => { if (!controller.signal.aborted) { setPins(next); setError(''); } })
            .catch(failure => { if (!controller.signal.aborted) setError(extractApiErrorMessage(failure, copy('Your pins could not load.', 'მიმაგრებები ვერ ჩაიტვირთა.'))); });
        return () => controller.abort();
    }, [revision, copy]);
    const pinned = useCallback((target: PinTarget) => pins.some(pin => same(pin, target)), [pins]);
    const toggle = useCallback(async (target: PinTarget) => {
        setError('');
        const existing = pins.find(pin => same(pin, target));
        try { setPins(existing ? await removePin(existing.id) : await addPin(target)); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('That pin couldn’t be saved.', 'მიმაგრება ვერ შეინახა.'))); }
    }, [pins, copy]);
    return { pins, pinned, toggle, error, full: pins.length >= MAX_PINS };
}
export type Pins = ReturnType<typeof usePins>;
