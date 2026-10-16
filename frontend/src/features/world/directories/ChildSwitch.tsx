import type { Participant } from '../../admissions/types';
import { Avatar, Chip } from '../../../design/primitives';
import { useWorldCopy } from '../copy';
import { first, type NavProps, type RememberedChoice } from '../directory/types';
import { firstName } from '../players';

/**
 * Beside "Training groups for Nino": the parent's children as faces, the chosen one pressed, so another child is one
 * press away. It writes the same `player` the filters read, and remembers it for the next World page.
 */
export function ChildSwitch({ query, go, children, remember }: NavProps & { children: Participant[]; remember?: RememberedChoice }) {
    const t = useWorldCopy();
    const chosen = first(query, 'player');
    if (children.length < 2 && children.some(child => String(child.id) === chosen)) return null;
    const choose = (id: string) => { remember?.write(id); go({ player: [id] }); };
    return (
        <span className="gk-world-childswitch" role="group" aria-label={t('Change child')}>
            {children.map(child => {
                const pressed = String(child.id) === chosen;
                return (
                    <Chip key={child.id} pressed={pressed} onClick={() => !pressed && choose(String(child.id))}>
                        <span className="gk-world-childswitch__face" aria-hidden="true"><Avatar name={child.name} size={20} /></span>{firstName(child.name)}
                    </Chip>
                );
            })}
        </span>
    );
}
