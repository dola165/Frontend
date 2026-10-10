import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Field } from '../../../design/primitives';
import { Dialog } from '../../../design/Dialog';
import { useRecruitmentCopy } from '../../../locales/recruitmentDesign';
import './recruitment.css';

interface DecisionNoteModalProps {
    title: string;
    subtitle: string;
    saving: boolean;
    /** Confirm button label; defaults to the translated "Accept". */
    confirmLabel?: string;
    /** Danger styling for decline flows. */
    danger?: boolean;
    /** i18n key for the "Use template" copy (defaults to the trial invitation). */
    templateKey?: string;
    onClose: () => void;
    onConfirm: (message: string | null) => void;
}

const MAX_NOTE_LENGTH = 1000;

/**
 * The optional note sent with a decision: accepting or declining an application or tryout, bulk decisions and
 * job applicants. Mounted fresh for each decision; the parent runs the change, so its error stays the one surface.
 * While a decision is saving the dialog cannot be closed.
 */
export const DecisionNoteModal = ({ title, subtitle, saving, confirmLabel, danger = false, templateKey = 'decisions.template', onClose, onConfirm }: DecisionNoteModalProps) => {
    const { t } = useTranslation();
    const r = useRecruitmentCopy();
    const [note, setNote] = useState('');
    const close = () => { if (!saving) onClose(); };
    const confirm = () => { if (!saving) onConfirm(note.trim() || null); };
    return <Dialog open title={title} description={subtitle} onClose={close} closeLabel={t('decisions.close')}
        footer={<><Button variant="ghost" disabled={saving} onClick={close}>{t('decisions.cancel')}</Button>
            <Button variant={danger ? 'danger' : 'primary'} disabled={saving} onClick={confirm}>{saving ? t('decisions.saving') : confirmLabel ?? t('decisions.accept')}</Button></>}>
        <Field label={t('decisions.noteLabel')} htmlFor="decision-note" hint={r('noteHint')}>
            <textarea id="decision-note" className="gk-input" value={note} disabled={saving} maxLength={MAX_NOTE_LENGTH} rows={5} autoFocus
                onChange={event => setNote(event.target.value)} placeholder={t('decisions.notePlaceholder')} />
        </Field>
        <div className="gk-row dn-foot">
            <Button size="sm" variant="ghost" disabled={saving} onClick={() => setNote(t(templateKey))}>{t('decisions.templateChip')}</Button>
            <span className="gk-faint gk-num dn-count">{t('decisions.charCount', { count: note.length })}</span>
        </div>
    </Dialog>;
};
