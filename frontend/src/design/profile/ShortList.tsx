import './profile-layout.css';
import { ChevronDown } from 'lucide-react';
import type { ShortListMore } from './useShortList';

/** The last row of a shortened list (see `useShortList`): "Show all 12", then "Show fewer". Goes inside a `List`. */
export function ShowAllRow({ more, showAll, showFewer }: { more: ShortListMore; showAll: string; showFewer: string }) {
    if (!more) return null;
    return <li><button type="button" className="gk-list-row gk-list-more" aria-expanded={more.all} onClick={more.toggle}>
        <span className="gk-list-row__main"><span className="gk-list-row__title">{more.all ? showFewer : showAll}</span></span>
        <ChevronDown aria-hidden="true" size={16} data-open={more.all || undefined} />
    </button></li>;
}
