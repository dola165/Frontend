import { useId } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { moveMenuFocus, openMenuFromKey, usePopover } from '../../components/layout/header/usePopover';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { ACTIONS, OPENED_HERE } from './registry';
import { useMenuActions } from './useMenuActions';
import './actions.css';

/** The header "+": a compact menu of what the person may start, hidden when there is nothing. */
export function ActionMenu() {
    const copy = useJourneyCopy();
    const actions = useMenuActions();
    const { open, toggle, show, close, triggerRef, panelRef, onKeyDown } = usePopover();
    const id = useId();
    if (!actions.length) return null;
    const owed = actions.some(action => action.waiting);
    return (
        <div className="gk-hanchor gk-header__plus" onKeyDown={onKeyDown}>
            <button ref={triggerRef} type="button" className="gk-hbtn gk-hbtn--plus" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
                aria-label={owed ? copy('Start something, a score is waiting', 'დაწყება, ანგარიში ელოდება') : copy('Start something', 'დაწყება')} title={copy('Start something', 'დაწყება')}
                onClick={toggle} onKeyDown={event => openMenuFromKey(event, show)}>
                <Plus aria-hidden="true" />{owed && <span className="gk-hbtn__dot" aria-hidden="true" />}
            </button>
            {open && (
                <div ref={panelRef} id={id} role="menu" tabIndex={-1} aria-label={copy('Start something', 'დაწყება')} className="gk-pop gk-pop--actions" onKeyDown={moveMenuFocus}>
                    {actions.map(action => {
                        const definition = ACTIONS[action.key];
                        const Icon = definition.icon;
                        return <Link key={action.key} role="menuitem" to={action.href} state={OPENED_HERE} className="gk-menu__item gk-action-item" onClick={() => close(false)}>
                            <Icon aria-hidden="true" className="gk-action__icon" style={definition.color ? { color: definition.color } : undefined} />
                            <span className="gk-action-item__text"><span>{copy(...definition.label)}</span>{action.hint && <small>{action.hint}</small>}</span>
                            {action.waiting && <span className="gk-action-dot" aria-label={copy('Waiting', 'ელოდება')} />}
                        </Link>;
                    })}
                </div>
            )}
        </div>
    );
}
