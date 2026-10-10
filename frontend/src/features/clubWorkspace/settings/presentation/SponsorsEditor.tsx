import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { Button, EmptyNote, Field, Panel } from '../../../../design/primitives';
import { ImageUploadField } from '../../../../components/workspace/editor/ImageUploadField';
import { LegacyIsland } from '../../../clubOperations/records/LegacyIsland';
import type { ClubSponsor } from '../../../clubs/presentation';

/** Sponsors shown on the club page. A restricted sponsor keeps its record; only its publication request can be turned off. */
export function SponsorsEditor({ sponsors, onChange, onUploading }: { sponsors: ClubSponsor[]; onChange: (sponsors: ClubSponsor[]) => void; onUploading: (busy: boolean) => void }) {
    const { i18n } = useTranslation();
    const georgian = (i18n.resolvedLanguage ?? i18n.language ?? 'en').startsWith('ka');
    const update = (index: number, value: Partial<ClubSponsor>) => onChange(sponsors.map((s, i) => i === index ? { ...s, ...value } : s));
    return <Panel flush title="Sponsors" action={<Button size="sm" disabled={sponsors.length >= 30} onClick={() => onChange([...sponsors, { name: '', logoUrl: null, websiteUrl: null, organizationId: null, published: false }])}><Plus aria-hidden="true" />Add sponsor</Button>}>
        <p className="rec-form__intro gk-muted">Sponsors appear on this club’s page only. They do not need a GrassKickZ account.</p>
        {sponsors.length ? sponsors.map((s, index) => <section key={s.id ?? `new-${index}`} aria-label={`Sponsor ${index + 1}`} className="rec-form__group">
            <div className="rec-form__group-head rec-form__group-head--split"><h3>{s.name || `Sponsor ${index + 1}`}</h3>
                {!s.promotionBlocked && <Button size="sm" variant="ghost" onClick={() => onChange(sponsors.filter((_, i) => i !== index))}><Trash2 aria-hidden="true" />Remove sponsor</Button>}</div>
            {s.promotionBlocked ? <div className="gk-notice gk-notice--warning" role="status">{georgian ? 'საჯარო გამოჩენა შეზღუდულია. ჩანაწერი და ისტორია შენარჩუნებულია; შეგიძლიათ გამორთოთ გამოქვეყნების მოთხოვნა.' : 'Public promotion is restricted. The record and history are retained; you can turn off its publication request.'}</div>
                : <div className="rec-fields">
                    <Field label="Sponsor name" htmlFor={`sponsor-${index}-name`}><input id={`sponsor-${index}-name`} className="gk-input" required maxLength={255} value={s.name} onChange={e => update(index, { name: e.target.value })} /></Field>
                    <Field label={<>Website <span className="rec-optional">(optional)</span></>} htmlFor={`sponsor-${index}-web`}><input id={`sponsor-${index}-web`} className="gk-input" type="url" maxLength={500} placeholder="https://" value={s.websiteUrl ?? ''} onChange={e => update(index, { websiteUrl: e.target.value || null })} /></Field>
                    <div className="rec-wide"><LegacyIsland><ImageUploadField label="Sponsor logo" max={1} context="logo" images={s.logoUrl ? [s.logoUrl] : []} onChange={images => update(index, { logoUrl: images[0] ?? null })} onBusyChange={onUploading} /></LegacyIsland></div>
                </div>}
            <label className="rec-switch"><span><strong>{s.promotionBlocked ? (georgian ? 'გამოქვეყნება მოთხოვნილია (შეზღუდული)' : 'Publication requested (restricted)') : 'Publish sponsor'}</strong></span>
                <input type="checkbox" className="gk-switch" checked={s.published} disabled={s.promotionBlocked && !s.published} onChange={e => update(index, { published: e.target.checked })} /></label>
        </section>) : <EmptyNote title="No sponsors yet">Add a sponsor to show them on the club page.</EmptyNote>}
    </Panel>;
}
