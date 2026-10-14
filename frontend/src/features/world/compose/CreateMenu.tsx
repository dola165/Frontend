import { useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronDown, Plus } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { moveMenuFocus, openMenuFromKey, usePopover } from '../../../components/layout/header/usePopover';
import { dayLabel } from '../../matchExchange/arrange/matchPlan';
import { useWorldCopy } from '../copy';
import { usePeek } from '../peek/usePeek';
import { drawDraftKey, drawPeek, drawStarted, loadDrawDraft } from '../../tournaments/create/drawDraft';
import { FORMAT_WORD } from '../../tournaments/shape/shapeOf';
import { arrangeDrafts, parseArrangeSeed, type ArrangeDraft } from './arrangeSeed';
import { useCreateActions, type CreateAction, type CreateId } from './createActions';
import './create.css';

const GROUPS: CreateAction['group'][] = ['Page', 'Matches', 'Club', 'Tournaments'];

/** "12 min ago", "3 h ago", "yesterday", "3 d ago": how long a draft has waited, by the calendar after a day. */
function waited(savedAt: number, t: ReturnType<typeof useWorldCopy>) {
    const minutes = Math.max(0, Math.round((Date.now() - savedAt) / 60000));
    if (minutes < 1) return t('just now');
    if (minutes < 60) return t('{n} min ago', { n: minutes });
    if (minutes < 24 * 60) return t('{n} h ago', { n: Math.floor(minutes / 60) });
    const midnight = (time: number) => { const day = new Date(time); day.setHours(0, 0, 0, 0); return day.getTime(); };
    const days = Math.round((midnight(Date.now()) - midnight(savedAt)) / 86_400_000);
    return days <= 1 ? t('yesterday') : t('{n} d ago', { n: days });
}

/** A draft as the match it will be: whom it invites (or that it is open) and when. */
function draftLabel({ seed, draft }: ArrangeDraft, t: ReturnType<typeof useWorldCopy>) {
    const who = parseArrangeSeed(seed).mode === 'open' ? t('Open match') : draft.opponent ? t('v {club}', { club: draft.opponent.name }) : t('Match invitation');
    return [who, draft.date ? `${dayLabel(draft.date)}${draft.time ? ` ${draft.time}` : ''}` : null].filter(Boolean).join(' · ');
}

/**
 * One "+" per World tab: the tab's likely action on its face ("+ Arrange a match") and a menu with unsent drafts first,
 * then everything else the person can start. Only what real permissions allow is offered, and the button is not shown
 * at all when there is nothing; without a likely action it reads "+ Create". A draft or a match opens in World's
 * frame, setting up an organisation on its own page.
 */
export function CreateMenu({ face }: { /** The tab's likely action, on the button itself when the person can take it. */ face?: CreateId }) {
    const t = useWorldCopy();
    const { user, sessionId } = useAuth();
    const actions = useCreateActions();
    const drawers = usePeek();
    const navigate = useNavigate();
    const { open, toggle, show, close, triggerRef, panelRef, onKeyDown } = usePopover();
    const id = useId();
    if (!actions?.length) return null;
    const main = actions.find(action => action.id === face);
    // Drafts are read when the menu opens, so it always offers what is in this browser session now.
    const drafts = open && actions.some(action => action.id === 'arrange') ? arrangeDrafts(user?.id, sessionId).slice(0, 3) : [];
    // The tournament being set up in the Draw room, once it holds something written.
    const kept = open && actions.some(action => action.id === 'create-tournament') ? loadDrawDraft(drawDraftKey(user?.id, sessionId)) : null;
    const tournament = kept && drawStarted(kept) ? kept : null;
    // Opening a drawer first gives focus back to the "+", so the drawer returns it there when it closes.
    const run = (action: Pick<CreateAction, 'peek' | 'to'>) => {
        close(Boolean(action.peek));
        if (action.peek) drawers.open(action.peek); else if (action.to) navigate(action.to);
    };
    return (
        <div className="gk-create" data-split={main ? true : undefined} onKeyDown={onKeyDown}>
            {main && <button type="button" className="gk-btn gk-btn--primary gk-create__main" onClick={() => run(main)}><Plus aria-hidden="true" />{t(main.label)}</button>}
            <button ref={triggerRef} type="button" className="gk-btn gk-btn--primary gk-create__more" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
                aria-label={main ? t('More to create') : undefined} onClick={toggle} onKeyDown={event => openMenuFromKey(event, show)}>
                {!main && <><Plus aria-hidden="true" />{t('Create')}</>}<ChevronDown aria-hidden="true" />
            </button>
            {open && (
                <div ref={panelRef} id={id} role="menu" tabIndex={-1} aria-label={t('Create')} className="gk-create__menu" onKeyDown={moveMenuFocus}>
                    {(drafts.length > 0 || tournament) && <div role="group" aria-labelledby={`${id}-drafts`} className="gk-create__group">
                        <p className="gk-create__label" id={`${id}-drafts`}>{t('Continue')}</p>
                        {drafts.map(item => (
                            <button key={item.seed} type="button" role="menuitem" className="gk-create__item gk-create__draft" onClick={() => run({ peek: `arrange-${item.seed}` })}>
                                <span className="gk-create__dot" aria-hidden="true" />
                                <span className="gk-create__text"><span>{draftLabel(item, t)}</span><small>{t('Draft')} · {waited(item.savedAt, t)}</small></span>
                                <ArrowRight aria-hidden="true" />
                            </button>
                        ))}
                        {tournament && <button type="button" role="menuitem" className="gk-create__item gk-create__draft" onClick={() => run({ peek: drawPeek() })}>
                            <span className="gk-create__dot" aria-hidden="true" />
                            <span className="gk-create__text"><span>{[tournament.name.trim() || t('New tournament'), t(FORMAT_WORD[tournament.rules.structure])].join(' · ')}</span><small>{t('Draft')} · {waited(tournament.savedAt, t)}</small></span>
                            <ArrowRight aria-hidden="true" />
                        </button>}
                    </div>}
                    {GROUPS.map(group => {
                        const items = actions.filter(action => action.group === group);
                        return items.length > 0 && (
                            <div key={group} role="group" aria-labelledby={`${id}-${group}`} className="gk-create__group">
                                <p className="gk-create__label" id={`${id}-${group}`}>{t(group)}</p>
                                {items.map(action => (
                                    <button key={action.id} type="button" role="menuitem" className="gk-create__item" onClick={() => run(action)}>
                                        <action.icon aria-hidden="true" /><span className="gk-create__text"><span>{t(action.label)}</span></span>
                                    </button>
                                ))}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
