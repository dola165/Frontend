import { Link } from 'react-router-dom';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { Button, Chip } from '../../design/primitives';
import { Dialog } from '../../design/Dialog';
import type { TabItem, WorkspaceTab } from '../../components/workspace/types';
import { essentialTabs, toolDescription, workspaceAreas, type ResponsibilityFocus, type WorkspaceLayout } from '../clubOperations/workspaceStructure';
import { navLabel } from './clubTabs';
import { workspaceNavEn } from '../../locales/workspaceDesign';
import { useCopy } from '../../locales/useCopy';
import './club-workspace.css';

/**
 * The person shapes their own rail: which responsibilities put their tools first, and which tools or whole areas
 * to hide (they wait under More tools). The essentials carry a lock and always stay. Nothing here changes access:
 * that comes from the club, and the way to ask for it is one line at the bottom.
 */
export function EditTabsDialog({ tabs, layout, focus, readOnly, onClose, onAskAccess }: {
    tabs: TabItem[]; layout: WorkspaceLayout; focus: ResponsibilityFocus; readOnly: (id: WorkspaceTab) => boolean; onClose: () => void; onAskAccess?: () => void;
}) {
    const copy = useCopy('workspaceNav', workspaceNavEn);
    const areas = workspaceAreas
        .map(area => ({ id: area.id, tools: (area.tabs as readonly WorkspaceTab[]).map(id => tabs.find(tab => tab.id === id)).filter((tab): tab is TabItem => Boolean(tab)) }))
        .filter(area => area.tools.length);
    return <Dialog open size="md" title={copy('editTabsTitle')} description={copy('editTabsHint')} onClose={onClose}
        footer={<><Button variant="ghost" disabled={!layout.customised && focus.selected.length === focus.available.length} onClick={() => { layout.reset(); focus.showAll(); }}>{copy('resetTabs')}</Button>
            <Button variant="primary" onClick={onClose}>{copy('done')}</Button></>}>
        <div className="gk-stack">
            {focus.available.length > 1 && <div className="cw-tabs__focus">
                <span className="cw-tabs__label">{copy('toolsFirstFor')}</span>
                <div className="gk-chips" role="group" aria-label={copy('toolsFirstFor')}>{focus.available.map(view => <Chip key={view.id} pressed={focus.selected.includes(view.id)} onClick={() => focus.toggle(view.id)}>{view.label}</Chip>)}</div>
            </div>}
            {areas.map(area => {
                const name = navLabel(`area-${area.id}`), areaHidden = layout.hiddenAreas.has(area.id), hideable = area.tools.some(tool => !essentialTabs.has(tool.id));
                return <section key={area.id} className="cw-tabs__area" data-hidden={areaHidden || undefined} aria-label={name}>
                    <header className="cw-tabs__head"><strong>{name}</strong>
                        {hideable && <button type="button" className="cw-tabs__eye" aria-pressed={!areaHidden} aria-label={areaHidden ? copy('showArea', { name }) : copy('hideArea', { name })} onClick={() => layout.toggleArea(area.id)}>
                            {areaHidden ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button>}
                    </header>
                    <ul className="cw-tabs__list">{area.tools.map(tool => {
                        const locked = essentialTabs.has(tool.id), hidden = layout.isHidden(tool.id), Icon = tool.icon;
                        return <li key={tool.id} className="cw-tabs__row" data-hidden={hidden || undefined}>
                            <Icon aria-hidden="true" className="cw-tabs__icon" />
                            <span className="cw-tabs__text">
                                <span className="cw-tabs__name">{tool.label}{readOnly(tool.id) && <span className="cw-tabs__view">{copy('viewOnly')}</span>}</span>
                                <span className="cw-tabs__desc">{toolDescription(tool)}</span>
                            </span>
                            {locked ? <span className="cw-tabs__locked"><Lock aria-hidden="true" /><span>{copy('alwaysShown')}</span></span>
                                : <button type="button" className="cw-tabs__eye" aria-pressed={!hidden} disabled={areaHidden} aria-label={hidden ? copy('showTool', { name: tool.label }) : copy('hideTool', { name: tool.label })} onClick={() => layout.toggleTab(tool.id)}>
                                    {hidden ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button>}
                        </li>;
                    })}</ul>
                </section>;
            })}
            <p className="cw-tabs__foot">
                {copy('accessFrom')} {onAskAccess && <button type="button" className="cw-text-button" onClick={onAskAccess}>{copy('askAccess')}</button>}<br />
                {copy('profileRoles')} <Link to="/account/roles">{copy('rolesAndWork')}</Link>
            </p>
        </div>
    </Dialog>;
}
