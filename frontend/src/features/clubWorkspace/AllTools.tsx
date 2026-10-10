import { useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Pin, PinOff } from 'lucide-react';
import { Badge, Button, EmptyNote, List, PageFrame, PageHeader, Panel, SearchInput, Section } from '../../design/primitives';
import type { TabItem, WorkspaceTab } from '../../components/workspace/types';
import { personalTabs, toolDescription, workspaceAreas, type OpenWorkspace } from '../clubOperations/workspaceStructure';
import { ClubMatchLinks } from './ClubMatchLinks';
import type { WorkspacePins } from './useWorkspacePins';
import './club-workspace.css';

/** Every tool this person may open, grouped by area, with pins for the ones they use most. */
export function AllTools({ tabs, pins, focus, onOpen, showHidden, onShowHidden, hasHidden }: {
    tabs: TabItem[]; pins: WorkspacePins; focus: Set<WorkspaceTab> | 'all'; onOpen: OpenWorkspace;
    showHidden: boolean; onShowHidden: (value: boolean) => void; hasHidden: boolean;
}) {
    const [query, setQuery] = useState('');
    const needle = query.trim().toLowerCase();
    const groups = workspaceAreas.map(area => ({ id: area.id, label: area.label, description: area.description, tools: (area.tabs as readonly string[]).map(id => tabs.find(tab => tab.id === id)).filter((tab): tab is TabItem => Boolean(tab)) }))
        .map(area => ({ ...area, tools: area.tools.filter(tab => !needle || `${tab.label} ${toolDescription(tab)} ${area.label}`.toLowerCase().includes(needle)) }))
        .filter(area => area.tools.length);
    const pinned = pins.pinned.filter(tab => !personalTabs.has(tab.id));

    const row = (tab: TabItem, controls: ReactNode) => <li key={tab.id}><div className="gk-list-row cw-tool-row">
        <span className="gk-list-row__lead cw-tool-row__icon"><tab.icon aria-hidden="true" /></span>
        <button type="button" className="cw-tool-row__open" onClick={() => onOpen(tab.id)}>
            <span className="gk-list-row__title">{tab.label}</span><span className="gk-list-row__meta">{toolDescription(tab)}</span>
        </button>
        <span className="gk-list-row__trail">{controls}</span>
    </div></li>;

    return <PageFrame className="cw-page">
        <PageHeader title="All tools" subtitle="Everything your club role allows. Pinned tools stay in your rail, on the overview and in the top bar."
            actions={<SearchInput className="cw-tools-search" aria-label="Find a workspace tool" placeholder="Find a tool, for example travel" value={query} onChange={event => setQuery(event.target.value)} />} />
        <div className="gk-stack">
            <Section title="Pinned" hint={pinned.length ? `${pinned.length}` : undefined}>
                <Panel flush>{pinned.length ? <List label="Pinned tools">{pinned.map((tab, index) => row(tab, <>
                    <Button size="sm" variant="ghost" iconOnly aria-label={`Move ${tab.label} up`} disabled={index === 0} onClick={() => pins.move(tab.id, -1)}><ArrowUp aria-hidden="true" /></Button>
                    <Button size="sm" variant="ghost" iconOnly aria-label={`Move ${tab.label} down`} disabled={index === pinned.length - 1} onClick={() => pins.move(tab.id, 1)}><ArrowDown aria-hidden="true" /></Button>
                    <Button size="sm" variant="ghost" iconOnly aria-label={`Unpin ${tab.label}`} onClick={() => pins.toggle(tab)}><PinOff aria-hidden="true" /></Button>
                </>))}</List> : <EmptyNote title="Nothing pinned yet">Pin a tool below and it appears in your rail, on the overview and as a tab in the top bar. Pins are saved on this browser.</EmptyNote>}</Panel>
            </Section>
            {hasHidden && <label className="cw-check"><input type="checkbox" checked={showHidden} onChange={event => onShowHidden(event.target.checked)} />Include tools the club has turned off, to see their history</label>}
            {groups.length ? <div className="cw-tool-groups">{groups.map(area => [<Section key={area.id} title={area.label} hint={area.description}>
                <Panel flush><List label={area.label}>{area.tools.map(tab => {
                    const isPinned = pins.isPinned(tab.id);
                    return row(tab, <>
                        {focus !== 'all' && focus.has(tab.id) && <Badge tone="accent">Your work</Badge>}
                        <Button size="sm" variant={isPinned ? 'secondary' : 'ghost'} aria-pressed={isPinned} disabled={!pins.available || (!isPinned && pins.full)} onClick={() => pins.toggle(tab)}
                            title={!isPinned && pins.full ? 'Your pins are full. Unpin something first.' : undefined}>
                            <Pin aria-hidden="true" /><span>{isPinned ? 'Pinned' : 'Pin'}</span><span className="gk-visually-hidden"> {tab.label}</span>
                        </Button>
                    </>);
                })}</List></Panel>
            </Section>,
            // The club's own match work sits beside the Football tools.
            area.id === 'football' && <ClubMatchLinks key="club-matches" filter={query} />])}
            {!groups.some(area => area.id === 'football') && <ClubMatchLinks filter={query} />}</div> : <EmptyNote title={`No tools match “${query}”`} action={<Button size="sm" onClick={() => setQuery('')}>Clear search</Button>}>Try another word, such as attendance, travel or finance.</EmptyNote>}
        </div>
    </PageFrame>;
}
