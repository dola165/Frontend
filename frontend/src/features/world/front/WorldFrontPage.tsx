import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '../../../design/primitives';
import { useWorldCopy } from '../copy';
import { useWorldArea, type WorldArea } from '../useWorldArea';
import { WorldSearch } from './WorldSearch';
import { Field } from './FrontBlocks';
import { useAroundMap } from './useAroundMap';
import { StageHead, StagePanel } from '../stage/WorldStage';
import { useStage } from '../stage/stageContext';
import { CustomizeOverview } from './CustomizeOverview';
import { fieldInfo, type FieldId } from './fields';
import { useOverviewLayout } from './useOverviewLayout';
import { SideFold } from './fields/fieldProps';
import { useWorldAudience } from './audience';
import { aRole, type OverviewLayout } from './roles';
import { useNearbyPlaces } from './useNearbyPlaces';
import { useSquadFocus } from './coach/mySquads';
import './front.css';
import './front-hero.css';

/** Who the page is for: a coach's squads in focus, otherwise the area and the role. */
function Subtitle({ area, role }: { area: WorldArea; role: OverviewLayout['role'] }) {
    const t = useWorldCopy();
    const focus = useSquadFocus(role);
    const names = focus.focus.map(squad => squad.name);
    if (focus.status === 'ready') return <p>{t('For {squads}, near {city}', { squads: names.length > 2 ? t('{count} squads', { count: names.length }) : names.join(` ${t('and')} `), city: area.city })}</p>;
    return <p>{t('Near {city}, set up for {role}', { city: area.city, role: aRole(role) })}</p>;
}

/**
 * GrassKickZ World's front page, the person's own: the area's map, tall and wide, with one field open beside
 * it, then the rest of their fields as the page scrolls. Search sits in the header; who and where it is for sit in
 * the World bar above. The person says who they are (Customize), which decides the page they start with and the
 * fields they are offered.
 */
export default function WorldFrontPage() {
    const t = useWorldCopy();
    const { area } = useWorldArea();
    const audience = useWorldAudience();
    const nearby = useNearbyPlaces(area);
    const { layout: saved, save } = useOverviewLayout(audience);
    // While customising, the page shows the draft; Save keeps it, Cancel goes back to the saved page.
    const [draft, setDraft] = useState<OverviewLayout | null>(null);
    const layout = draft ?? saved;
    useAroundMap(area, nearby);
    // The field over the map folds to its header so the whole map shows; the World stage keeps that (`panel`).
    const stage = useStage();
    const fold = { folded: stage.panelFolded, toggle: stage.togglePanel };
    // Lists that follow each other share rows; a card field (clubs) takes the page's width on its own.
    const rows = layout.fields.reduce<FieldId[][]>((all, id) => {
        const last = all[all.length - 1];
        if (fieldInfo(id).shape === 'list' && last && fieldInfo(last[0]).shape === 'list') last.push(id); else all.push([id]);
        return all;
    }, []);
    return (
        <div className="gk-world-front">
            <StageHead>
                <header className="gk-world-head">
                    <div className="gk-world-head__titles">
                        <h1>{t('GrassKickZ World')}</h1>
                        <Subtitle area={area} role={layout.role} />
                    </div>
                    <WorldSearch />
                    <div className="gk-world-head__actions">
                        <Button onClick={() => setDraft(saved)}><SlidersHorizontal aria-hidden="true" />{t('Customize')}</Button>
                    </div>
                </header>
            </StageHead>
            <StagePanel><SideFold.Provider value={fold}><Field id={layout.side} area={area} markers={nearby} role={layout.role} side /></SideFold.Provider></StagePanel>
            {rows.length > 0 && <div className="gk-world-front__fields">
                <div className="gk-world-front__fields-head">
                    <h2>{t('For you as {role}', { role: aRole(layout.role) })}</h2>
                    <Button size="sm" variant="ghost" onClick={() => setDraft(saved)}><SlidersHorizontal aria-hidden="true" />{t('Change what you see')}</Button>
                </div>
                {rows.map(row => <div key={row.join()} className="gk-world-front__row">{row.map(id => <Field key={id} id={id} area={area} markers={nearby} role={layout.role} />)}</div>)}
            </div>}
            {draft && <CustomizeOverview draft={draft} saved={saved} onChange={setDraft} onCancel={() => setDraft(null)} onSave={() => { save(draft); setDraft(null); }} />}
        </div>
    );
}
