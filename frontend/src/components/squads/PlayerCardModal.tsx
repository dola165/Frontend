import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Plus, Upload, X } from 'lucide-react';
import { createPlayerCard } from '../../features/clubs/api';
import { apiClient } from '../../api/axiosConfig';

interface PlayerCardModalProps {
    clubId: number;
    squadId: number;
    isOpen: boolean;
    onClose: () => void;
    onCardCreated: () => void;
}

const POSITIONS = [
    'GOALKEEPER', 'CENTER_BACK', 'FULLBACK', 'DEFENSIVE_MIDFIELDER',
    'CENTRAL_MIDFIELDER', 'ATTACKING_MIDFIELDER', 'WINGER', 'STRIKER'
];

/**
 * Club-created Player Card (WEB_APP_MASTER_PLAN.md §2.2) — a roster entry for
 * a kid without a GrassKickZ account. U13 cards never carry photos; the server
 * rejects the payload if the UI misses it.
 */
export const PlayerCardModal = ({ clubId, squadId, isOpen, onClose, onCardCreated }: PlayerCardModalProps) => {
    const { t } = useTranslation();
    const [fullName, setFullName] = useState('');
    const [birthYear, setBirthYear] = useState('');
    const [position, setPosition] = useState('GOALKEEPER');
    const [jerseyNumber, setJerseyNumber] = useState('');
    const [parentEmail, setParentEmail] = useState('');
    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const currentYear = new Date().getFullYear();
    const under13 = birthYear ? currentYear - Number(birthYear) < 13 : false;

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        setError(null);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('context', 'player-card');
            const res = await apiClient.post('/media/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setPhotoUrl(res.data.url);
        } catch (err) {
            console.error(err);
            setError(t('minors.playerCard.photoFailed'));
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fullName.trim()) {
            setError(t('minors.playerCard.nameRequired'));
            return;
        }
        const year = Number(birthYear);
        if (!year || year < currentYear - 100 || year > currentYear - 4) {
            setError(t('minors.playerCard.birthYearInvalid'));
            return;
        }
        setSaving(true);
        setError(null);
        try {
            await createPlayerCard(clubId, {
                fullName: fullName.trim(),
                birthYear: year,
                position: position || null,
                jerseyNumber: jerseyNumber ? Number(jerseyNumber) : null,
                photoUrl,
                parentEmail: parentEmail.trim() || null,
                squadId,
            });
            onCardCreated();
            onClose();
        } catch (err: unknown) {
            const apiMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            const errMessage = err instanceof Error ? err.message : undefined;
            setError(apiMessage ?? errMessage ?? t('minors.playerCard.failed'));
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    const inputClass = 'theme-surface-strong theme-border w-full border px-3 py-2 text-sm font-semibold text-[#f4f4f5] outline-none transition-colors focus:border-[#16a34a] placeholder:text-[#a1a1aa]';

    return (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center">
            <div className="theme-overlay absolute inset-0" onClick={onClose} />
            <div className="relative z-10 mx-4 w-full max-w-md border border-[#ffffff0d] bg-[#0f1117] shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[#ffffff0d] px-5 py-4">
                    <div className="flex items-center gap-3">
                        <Plus className="h-5 w-5 text-[#16a34a]" />
                        <div>
                            <h2 className="text-sm font-semibold  text-[#f4f4f5]">{t('minors.playerCard.title')}</h2>
                            <p className="mt-0.5 text-[11px] font-medium text-[#a1a1aa]">
                                {t('minors.playerCard.subtitle')}
                            </p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="p-1 text-[#a1a1aa] hover:text-[#f4f4f5]">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 py-5">
                    {error && (
                        <div className="border border-[color:var(--state-danger)] bg-[color:var(--state-danger-soft)] px-3 py-2 text-xs font-semibold text-[color:var(--state-danger)]">
                            {error}
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold  text-[#a1a1aa]">{t('minors.playerCard.fullName')}</label>
                        <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required
                            maxLength={120}
                            className={inputClass}
                            placeholder={t('minors.playerCard.namePlaceholder')}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold  text-[#a1a1aa]">{t('minors.playerCard.birthYear')}</label>
                            <input
                                type="number"
                                min={currentYear - 100}
                                max={currentYear - 4}
                                value={birthYear}
                                onChange={(e) => setBirthYear(e.target.value)}
                                required
                                className={inputClass}
                                placeholder={t('minors.playerCard.yearPlaceholder')}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold  text-[#a1a1aa]">{t('minors.playerCard.jerseyNumber')}</label>
                            <input
                                type="number"
                                min={1}
                                max={99}
                                value={jerseyNumber}
                                onChange={(e) => setJerseyNumber(e.target.value)}
                                className={inputClass}
                                placeholder={t('minors.playerCard.numberPlaceholder')}
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold  text-[#a1a1aa]">{t('minors.playerCard.position')}</label>
                        <select value={position} onChange={(e) => setPosition(e.target.value)} className={inputClass}>
                            {POSITIONS.map((p) => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold  text-[#a1a1aa]">{t('minors.playerCard.parentEmail')}</label>
                        <input
                            type="email"
                            value={parentEmail}
                            onChange={(e) => setParentEmail(e.target.value)}
                            className={inputClass}
                            placeholder={t('minors.playerCard.parentEmailPlaceholder')}
                        />
                        <p className="text-[10px] font-semibold  text-muted">{t('minors.playerCard.parentEmailHint')}</p>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold  text-[#a1a1aa]">{t('minors.playerCard.photo')}</label>
                        {under13 ? (
                            <p className="text-[10px] font-semibold  text-[color:var(--state-danger)]">
                                {t('minors.playerCard.photoRule')}
                            </p>
                        ) : (
                            <div className="flex items-center gap-3">
                                <label className="inline-flex cursor-pointer items-center gap-2 border border-[#ffffff0d] bg-elevated px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa] hover:text-[#f4f4f5]">
                                    <Upload className="h-3.5 w-3.5" />
                                    {uploading ? t('minors.playerCard.uploading') : photoUrl ? t('minors.playerCard.replacePhoto') : t('minors.playerCard.uploadPhoto')}
                                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
                                </label>
                                {photoUrl && <span className="text-[10px] font-semibold  text-[#16a34a]">{t('minors.playerCard.attached')}</span>}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 border-t border-[#ffffff0d] pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="border border-[#ffffff0d] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa] hover:text-[#f4f4f5]"
                        >
                            {t('minors.playerCard.cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={saving || uploading}
                            className="inline-flex items-center gap-2 border border-[#16a34a] bg-[#16a34a] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : t('minors.playerCard.create')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
