import { List, Panel, Section } from '../../design/primitives';
import type { RolesWorkspace } from '../clubOperations/useWorkspaceRoles';
import { focusTabs, type ResponsibilityFocus } from '../clubOperations/workspaceStructure';
import { responsibilitiesEn } from '../../locales/workspaceDesign';
import { useCopy } from '../../locales/useCopy';
import { viewSquads } from './coachHub/coachData';
import './club-workspace.css';

/**
 * Which approved responsibilities put their tools first in the club workspace rail. A personal view on this
 * browser: it never grants or removes access. Shown only to people with more than one responsibility.
 */
export function FocusSwitches({ roles, focus }: { roles: RolesWorkspace; focus: ResponsibilityFocus }) {
    const copy = useCopy('responsibilities', responsibilitiesEn);
    if (focus.available.length < 2) return null;
    return <Section title={copy('focusTitle')} hint={copy('focusHint')}>
        <Panel flush>
            <List label={copy('approved')}>{focus.available.map(view => {
                const on = focus.selected.includes(view.id), last = on && focus.selected.length === 1;
                const tools = focusTabs([view]), where = viewSquads(view, roles);
                return <li key={view.id}><label className="gk-list-row cw-switch-row">
                    <span className="gk-list-row__main">
                        <span className="gk-list-row__title">{view.label}</span>
                        <span className="gk-list-row__meta">{where === 'club' ? copy('wholeClub') : where ?? copy('noSquadsAssigned')} · {tools === 'all' ? copy('everyTool') : copy('tools', { count: tools.size })}</span>
                        {last && <span className="gk-list-row__meta" id={`cw-last-${view.id}`}>{copy('keepOne')}</span>}
                    </span>
                    <input type="checkbox" role="switch" className="gk-switch" checked={on} disabled={last} onChange={() => focus.toggle(view.id)}
                        aria-label={copy('showFirst', { name: view.label })} aria-describedby={`cw-focus-hint${last ? ` cw-last-${view.id}` : ''}`} />
                </label></li>;
            })}</List>
            <p className="gk-panel__foot cw-muted" id="cw-focus-hint">{copy('focusFoot')}</p>
        </Panel>
    </Section>;
}
