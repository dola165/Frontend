import { useId } from 'react';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { Button } from '../../../design/primitives';
import { Dialog } from '../../../design/Dialog';
import { useWorldCopy } from '../copy';
import { FIELDS, FIELD_GROUPS, fieldInfo, type FieldId, type FieldInfo } from './fields';
import { ROLES, ROLE_GROUPS, offeredFor, roleInfo, roleLayout, type OverviewLayout } from './roles';

const same = (a: OverviewLayout, b: OverviewLayout) => a.role === b.role && a.side === b.side && a.fields.join() === b.fields.join();

/**
 * The person's own World front page. First who they are: the role decides the page they start with and the
 * fields they are offered, so the choices fit them. Then the field beside the map, and the fields below in
 * order. The page behind shows the draft as it changes; nothing is kept until Save.
 */
export function CustomizeOverview({ draft, saved, onChange, onSave, onCancel }: {
    draft: OverviewLayout; saved: OverviewLayout; onChange: (layout: OverviewLayout) => void; onSave: () => void; onCancel: () => void;
}) {
    const t = useWorldCopy();
    const sideId = useId();
    const role = roleInfo(draft.role);
    const offered = offeredFor(draft.role);
    const chosen = new Set<FieldId>([draft.side, ...draft.fields]);
    const move = (index: number, by: number) => {
        const fields = [...draft.fields];
        const [field] = fields.splice(index, 1);
        fields.splice(index + by, 0, field);
        onChange({ ...draft, fields });
    };
    // The field that leaves the map's side moves to the top of the page, so nothing disappears.
    const putBeside = (side: FieldId) => onChange({ ...draft, side, fields: [draft.side, ...draft.fields.filter(id => id !== side)] });
    const add = (id: FieldId) => onChange({ ...draft, fields: [...draft.fields, id] });
    const addRow = (field: FieldInfo) => {
        const Icon = field.icon;
        return <li key={field.id} className="gk-wcustom__row">
            <Icon aria-hidden="true" className="gk-wcustom__icon" />
            <span className="gk-wcustom__name">{t(field.title)}<small>{t(field.description)}</small></span>
            <Button size="sm" onClick={() => add(field.id)}><Plus aria-hidden="true" />{t('Add')}</Button>
        </li>;
    };
    const suggested = offered.filter(id => !chosen.has(id)).map(fieldInfo);
    const others = FIELDS.filter(field => !chosen.has(field.id) && !offered.includes(field.id));
    const sideOptions = (ids: FieldId[]) => ids.map(fieldInfo).filter(field => field.shape === 'list').map(field => <option key={field.id} value={field.id}>{t(field.title)}</option>);

    return (
        <Dialog open size="sheet" title={t('Your World page')} description={t('Choose who you are, then what you see and in which order. Only you see this page.')} onClose={onCancel}
            footer={<>
                {!same(draft, roleLayout(draft.role)) && <Button variant="ghost" onClick={() => onChange(roleLayout(draft.role))}>{t('Reset to the {role} page', { role: t(role.label).toLowerCase() })}</Button>}
                <Button onClick={onCancel}>{t('Cancel')}</Button>
                <Button variant="primary" disabled={same(draft, saved)} onClick={onSave}>{t('Save')}</Button>
            </>}>
            <section className="gk-wcustom__block" aria-label={t('I am a')}>
                <h3>{t('I am a')}</h3>
                {ROLE_GROUPS.map(group => <div key={group} className="gk-wcustom__roles" role="radiogroup" aria-label={t(group)}>
                    <span className="gk-wcustom__group">{t(group)}</span>
                    {ROLES.filter(item => item.group === group).map(item => <button key={item.id} type="button" role="radio" className="gk-chip" aria-checked={item.id === draft.role}
                        onClick={() => item.id !== draft.role && onChange(roleLayout(item.id))}>{t(item.label)}</button>)}
                </div>)}
            </section>
            <section className="gk-wcustom__block">
                <h3><label htmlFor={sideId}>{t('Beside the map')}</label></h3>
                <select id={sideId} className="gk-input" value={draft.side} onChange={event => putBeside(event.target.value as FieldId)}>
                    <optgroup label={t('For a {role}', { role: t(role.label).toLowerCase() })}>{sideOptions(offered)}</optgroup>
                    <optgroup label={t('Everything else')}>{sideOptions(FIELDS.map(field => field.id).filter(id => !offered.includes(id)))}</optgroup>
                </select>
            </section>
            <section className="gk-wcustom__block" aria-label={t('Below the map')}>
                <h3>{t('Below the map')}</h3>
                {draft.fields.length ? <ol className="gk-wcustom__list">{draft.fields.map((id, index) => {
                    const info = fieldInfo(id), Icon = info.icon;
                    return <li key={id} className="gk-wcustom__row">
                        <Icon aria-hidden="true" className="gk-wcustom__icon" />
                        <span className="gk-wcustom__name">{t(info.title)}</span>
                        <Button size="sm" variant="ghost" iconOnly aria-label={t('Move {name} up', { name: t(info.title) })} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp aria-hidden="true" /></Button>
                        <Button size="sm" variant="ghost" iconOnly aria-label={t('Move {name} down', { name: t(info.title) })} disabled={index === draft.fields.length - 1} onClick={() => move(index, 1)}><ArrowDown aria-hidden="true" /></Button>
                        <Button size="sm" variant="ghost" iconOnly aria-label={t('Remove {name}', { name: t(info.title) })} onClick={() => onChange({ ...draft, fields: draft.fields.filter(field => field !== id) })}><X aria-hidden="true" /></Button>
                    </li>;
                })}</ol> : <p className="gk-faint">{t('Only the map and the field beside it. Add more below.')}</p>}
            </section>
            {suggested.length > 0 && <section className="gk-wcustom__block" aria-label={t('More for a {role}', { role: t(role.label).toLowerCase() })}>
                <h3>{t('More for a {role}', { role: t(role.label).toLowerCase() })}</h3>
                <ul className="gk-wcustom__list">{suggested.map(addRow)}</ul>
            </section>}
            {others.length > 0 && <details className="gk-wcustom__more">
                <summary>{t('Every other field ({count})', { count: others.length })}</summary>
                {FIELD_GROUPS.map(group => {
                    const rows = others.filter(field => field.group === group);
                    return rows.length > 0 && <section key={group} className="gk-wcustom__block" aria-label={t(group)}>
                        <h3>{t(group)}</h3>
                        <ul className="gk-wcustom__list">{rows.map(addRow)}</ul>
                    </section>;
                })}
            </details>}
        </Dialog>
    );
}
