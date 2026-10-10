import type { ReactNode } from 'react';
import { Field } from '../../../design/primitives';
import { label, type Bootstrap, type Definition, type Field as FieldDefinition } from '../api';
import { fieldHelp, fieldLabel } from '../editorPresentation';

/** A datetime from the server shown in the person's local time for a datetime-local input. */
const localTime = (value: string) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const linkKinds: Record<string, string> = { collectionReference: 'COLLECTION', requirementsReference: 'COMPETITION_REQUIREMENTS', permissionReference: 'CONSENT' };

/** The input for one field of a record definition, using the design-system input styles. */
export function RecordInput({ field, value, onChange, boot, id, describedBy }: { field: FieldDefinition; value: string; onChange: (value: string) => void; boot: Bootstrap; id: string; describedBy?: string }) {
    const common = { id, className: 'gk-input', required: field.required || field.key === 'placeType', value, 'aria-describedby': describedBy, onChange: (event: { target: { value: string } }) => onChange(event.target.value) };
    if (field.key === 'placeType') return <select {...common}><option value="">Choose venue or facility</option><option value="VENUE">Venue: matches or football training</option><option value="FACILITY">Facility: gym, changing rooms, medical room or clubhouse</option></select>;
    if (field.type === 'textarea' || field.type === 'urls') return <textarea {...common} maxLength={4000} rows={3} />;
    if (field.type === 'choice') return <select {...common}><option value="">Choose</option>{field.options.map(option => <option key={option} value={option}>{label(option)}</option>)}</select>;
    if (field.type === 'currency') return <select {...common}><option value="">Choose currency</option>{[...new Set(['GEL', 'EUR', 'GBP', 'USD', value])].filter(Boolean).map(code => <option key={code}>{code}</option>)}</select>;
    if (field.type === 'datetime') return <input {...common} type="datetime-local" value={localTime(value)} onChange={event => onChange(event.target.value ? new Date(event.target.value).toISOString() : '')} />;
    if (field.type === 'date') return <input {...common} type="date" />;
    if (field.key === 'venueId') return <select {...common}><option value="">No linked venue</option>{boot.venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select>;
    if (linkKinds[field.key]) return <select {...common}><option value="">Choose authorisation</option>{boot.links.filter(link => link.kind === linkKinds[field.key]).map(link => <option key={link.id} value={link.id}>{link.title}</option>)}</select>;
    if (['integer', 'money', 'latitude', 'longitude'].includes(field.type)) return <input {...common} type="number"
        min={field.type === 'latitude' ? -90 : field.type === 'longitude' ? -180 : field.type === 'money' ? 0 : 1} max={field.type === 'latitude' ? 90 : field.type === 'longitude' ? 180 : undefined}
        step={field.type === 'integer' ? 1 : field.type === 'money' ? '.01' : 'any'} />;
    return <input {...common} maxLength={500} />;
}

/** A labelled field: required ones plainly, optional ones marked, with the help text beside the input. */
export function RecordField({ definition, field, value, onChange, boot }: { definition: Definition; field: FieldDefinition; value: string; onChange: (value: string) => void; boot: Bootstrap }) {
    const id = `rec-${field.key}`, help = fieldHelp(definition.kind, field.key);
    return <div className={['textarea', 'urls'].includes(field.type) ? 'rec-wide' : undefined}>
        <Field htmlFor={id} label={<>{fieldLabel(field)}{!field.required && field.key !== 'placeType' && <span className="rec-optional"> (optional)</span>}</>} hint={help && <span id={`${id}-help`}>{help}</span>}>
            <RecordInput field={field} value={value} onChange={onChange} boot={boot} id={id} describedBy={help ? `${id}-help` : undefined} />
        </Field>
    </div>;
}

/** A labelled select or input for the record's own columns (squad, person, responsible staff). */
export function PlainField({ id, label: text, optional, hint, wide, children }: { id: string; label: ReactNode; optional?: boolean; hint?: ReactNode; wide?: boolean; children: ReactNode }) {
    return <div className={wide ? 'rec-wide' : undefined}><Field htmlFor={id} hint={hint} label={<>{text}{optional && <span className="rec-optional"> (optional)</span>}</>}>{children}</Field></div>;
}
