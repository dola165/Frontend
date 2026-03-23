import { useState } from 'react';
import { X, Swords, Send, Loader2, CalendarDays } from 'lucide-react';

interface MatchInviteModalProps {
    targetClubName: string;
    onClose: () => void;
    onSubmit: (inviteData: any) => Promise<void>;
}

export const MatchInviteModal = ({ targetClubName, onClose, onSubmit }: MatchInviteModalProps) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        matchType: 'FRIENDLY',
        proposedDate: ''
    });

    const handleSubmit = async () => {
        if (!formData.proposedDate) {
            setError('A proposed date is required.');
            return;
        }

        setIsSubmitting(true);
        setError(null);
        try {
            await onSubmit({
                matchType: formData.matchType,
                proposedDate: formData.proposedDate
            });
            onClose();
        } catch (error) {
            console.error("Failed to send invite", error);
            setError('Failed to send challenge. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="theme-overlay fixed inset-0 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className="theme-surface w-full max-w-lg rounded-lg border-2 theme-border shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="theme-surface-strong p-5 border-b theme-border flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center">
                            <Swords className="w-4 h-4 text-rose-600 dark:text-rose-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black uppercase tracking-widest text-slate-900 dark:text-white leading-tight">Issue Challenge</h2>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">vs {targetClubName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-rose-500 transition-colors"><X className="w-5 h-5" /></button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5">
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">Match Type</label>
                        <select
                            value={formData.matchType}
                            onChange={(e) => setFormData({...formData, matchType: e.target.value})}
                            className="theme-surface-strong w-full border theme-border rounded-sm px-3 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 font-medium"
                        >
                            <option value="FRIENDLY">Friendly</option>
                            <option value="COMPETITIVE">Competitive</option>
                        </select>
                    </div>

                    <div>
                        <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
                            <CalendarDays className="w-3.5 h-3.5" /> Proposed Date
                        </label>
                        <input
                            type="datetime-local"
                            value={formData.proposedDate}
                            onChange={(e) => {
                                setFormData({...formData, proposedDate: e.target.value});
                                if (error) setError(null);
                            }}
                            className="theme-surface-strong w-full border theme-border rounded-sm px-3 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 font-medium"
                        />
                    </div>

                    {error && (
                        <div className="rounded-md border border-rose-300/60 bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400">
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="theme-surface-strong p-5 border-t theme-border flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 rounded-sm font-bold uppercase text-[10px] tracking-widest text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">Cancel</button>
                    <button onClick={handleSubmit} disabled={isSubmitting || !formData.proposedDate} className="bg-rose-600 hover:bg-rose-500 text-white px-6 py-2.5 rounded-sm font-black uppercase text-[10px] tracking-widest shadow-[4px_4px_0px_0px_#020617] active:translate-y-0.5 active:shadow-none transition-all border border-transparent disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Send Challenge</>}
                    </button>
                </div>
            </div>
        </div>
    );
};
