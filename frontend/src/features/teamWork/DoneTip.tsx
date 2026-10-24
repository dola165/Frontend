import { useJourneyCopy } from '../squadCommunication/journeyCopy';

/**
 * The tip itself; useDoneTip says when it shows and ties it to the button. One plain text, so a screen reader hears
 * all of it as the button's description even while the tip is out of sight.
 */
export function DoneTip({ id, doneMeans }: { id: string; doneMeans: string | null | undefined }) {
    const copy = useJourneyCopy();
    return <span id={id} role="tooltip" className="tw-tip" data-empty={doneMeans ? undefined : ''}>
        {doneMeans ? copy(`Done means: ${doneMeans}`, `მზადაა, როცა: ${doneMeans}`) : copy('Done means not written yet', '„მზადაა, როცა“ ჯერ არ დაწერილა')}
    </span>;
}
