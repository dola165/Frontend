import { useId } from 'react';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { Button } from '../../../design/primitives';
import { Dialog } from '../../../design/Dialog';
import { useWorldCopy } from '../copy';
import type { WorldAudience } from './audience';
import { FIELDS, PRESETS, fieldInfo, type FieldId, type OverviewLayout } from './fields';

const GROUPS = ['Matches', 'People', 'Clubs and places', 'Opportunities'] as const;
const same = (a: OverviewLayout, b: OverviewLayout) => a.side === b.side && a.fields.join() === b.fields.join();

/**
 * The person's own World front page: start from the preset nearest their job, choose what sits beside the
 * map, then add, remove and order the rest. Every change shows on the page behind at once.
 */
export function CustomizeOverview({ audience, layout, customised, onChange, onReset, onClose }: {
    audience: WorldAudience; layout: OverviewLayout; customised: boolean;
    onChange: (layout: OverviewLayout) => void; onReset: () => void; onClose: () => void;
}) {
    const t = useWorldCopy();
    const sideId = useId();
    const chosen = new Set<FieldId>([layout.side, ...layout.fields]);
    const move = (index: number, by: number) => {
        const fields = [...layout.fields];
        const [field] = fields.splice(index, 1);
        fields.splice(index + by, 0, field);
        onChange({ ...layout, fields });
    };
    // The field that leaves the map's side moves to the top of the page, so nothing disappears.
    const putBeside = (side: FieldId) => onChange({ side, fields: [layout.side, ...layout.fields.filter(id => id !== side)] });

    return (
        <Dialog open size="sheet" title={t('Your World page')} description={t('Choose what you see here and in which order. Only you see this layout.')} onClose={onClose}
            footer={<>{customised && <Button variant="ghost" onClick={onReset}>{t('Back to the default')}</Button>}<Button variant="primary" onClick={onClose}>{t('Done')}</Button></>}>
            {audience === 'coach' && <section className="gk-wcustom__block" aria-label={t('Start from')}>
                <h3>{t('Start from')}</h3>
                <div className="gk-wcustom__presets">{PRESETS.map(preset => <button key={preset.id} type="button" className="gk-chip" aria-pressed={same(preset.layout, layout)}
                    onClick={() => onChange(preset.layout)}>{t(preset.label)}</button>)}</div>
            </section>}
            <section className="gk-wcustom__block">
                <h3><label htmlFor={sideId}>{t('Beside the map')}</label></h3>
                <select id={sideId} className="gk-input" value={layout.side} onChange={event => putBeside(event.target.value as FieldId)}>
                    {GROUPS.map(group => <optgroup key={group} label={t(group)}>{FIELDS.filter(field => field.group === group && field.shape === 'list').map(field => <option key={field.id} value={field.id}>{t(field.title)}</option>)}</optgroup>)}
                </select>
            </section>
            <section className="gk-wcustom__block" aria-label={t('Below the map')}>
                <h3>{t('Below the map')}</h3>
                {layout.fields.length ? <ol className="gk-wcustom__list">{layout.fields.map((id, index) => {
                    const info = fieldInfo(id), Icon = info.icon;
                    return <li key={id} className="gk-wcustom__row">
                        <Icon aria-hidden="true" className="gk-wcustom__icon" />
                        <span className="gk-wcustom__name">{t(info.title)}</span>
                        <Button size="sm" variant="ghost" iconOnly aria-label={t('Move {name} up', { name: t(info.title) })} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp aria-hidden="true" /></Button>
                        <Button size="sm" variant="ghost" iconOnly aria-label={t('Move {name} down', { name: t(info.title) })} disabled={index === layout.fields.length - 1} onClick={() => move(index, 1)}><ArrowDown aria-hidden="true" /></Button>
                        <Button size="sm" variant="ghost" iconOnly aria-label={t('Remove {name}', { name: t(info.title) })} onClick={() => onChange({ ...layout, fields: layout.fields.filter(field => field !== id) })}><X aria-hidden="true" /></Button>
                    </li>;
                })}</ol> : <p className="gk-faint">{t('Only the map and the field beside it. Add more below.')}</p>}
            </section>
            {GROUPS.map(group => {
                const more = FIELDS.filter(field => field.group === group && !chosen.has(field.id));
                return more.length > 0 && <section key={group} className="gk-wcustom__block" aria-label={t(group)}>
                    <h3>{t('Add')}: {t(group)}</h3>
                    <ul className="gk-wcustom__list">{more.map(field => {
                        const Icon = field.icon;
                        return <li key={field.id} className="gk-wcustom__row">
                            <Icon aria-hidden="true" className="gk-wcustom__icon" />
                            <span className="gk-wcustom__name">{t(field.title)}<small>{t(field.description)}</small></span>
                            <Button size="sm" onClick={() => onChange({ ...layout, fields: [...layout.fields, field.id] })}><Plus aria-hidden="true" />{t('Add')}</Button>
                        </li>;
                    })}</ul>
                </section>;
            })}
        </Dialog>
    );
}
