import { useState } from 'react';
import { X, Swords, MapPin, Users, Send, Loader2 } from 'lucide-react';

interface MatchInviteModalProps {
    targetClubName: string;
    onClose: () => void;
    onSubmit: (inviteData: any) => Promise<void>;
}

export const MatchInviteModal = ({ targetClubName, onClose, onSubmit }: MatchInviteModalProps) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        squadType: 'FIRST_TEAM',
        locationPref: 'HOME',
        willingToTravel: false,
        message: ''
    });

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            await onSubmit(formData);
            onClose();
        } catch (error) {
            console.error("Failed to send invite", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#1e293b] w-full max-w-lg rounded-lg border-2 border-slate-300 dark:border-black shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
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
                    {/* Squad Selection */}
                    <div>
                        <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
                            <Users className="w-3.5 h-3.5" /> Target Squad
                        </label>
                        <select
                            value={formData.squadType}
                            onChange={(e) => setFormData({...formData, squadType: e.target.value})}
                            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-sm px-3 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 font-medium"
                        >
                            <option value="FIRST_TEAM">First Team (Men's)</option>
                            <option value="WOMENS_FIRST">First Team (Women's)</option>
                            <option value="U21">Under 21 (U21)</option>
                            <option value="U18">Under 18 (U18)</option>
                            <option value="U16">Under 16 (U16)</option>
                        </select>
                    </div>

                    {/* Location Preference */}
                    <div>
                        <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
                            <MapPin className="w-3.5 h-3.5" /> Location / Venue
                        </label>
                        <select
                            value={formData.locationPref}
                            onChange={(e) => setFormData({...formData, locationPref: e.target.value})}
                            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-sm px-3 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 font-medium"
                        >
                            <option value="HOME">Our Stadium (We Host)</option>
                            <option value="AWAY">Their Stadium (We Travel)</option>
                            <option value="NEUTRAL">Neutral Venue / TBD</option>
                            <option value="ANY">Flexible (Any location works)</option>
                        </select>
                    </div>

                    {/* Willing to travel toggle */}
                    {formData.locationPref !== 'AWAY' && (
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${formData.willingToTravel ? 'bg-emerald-500 border-emerald-500' : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 group-hover:border-emerald-500'}`}>
                                {formData.willingToTravel && <div className="w-2.5 h-2.5 bg-white rounded-sm" />}
                            </div>
                            <input type="checkbox" className="hidden" checked={formData.willingToTravel} onChange={(e) => setFormData({...formData, willingToTravel: e.target.checked})} />
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">We are willing to travel if necessary</span>
                        </label>
                    )}

                    {/* Notes */}
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">Terms / Message</label>
                        <textarea
                            rows={3}
                            placeholder="Propose a date, specific rules, or friendly terms..."
                            value={formData.message}
                            onChange={(e) => setFormData({...formData, message: e.target.value})}
                            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-sm px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 resize-none font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 rounded-sm font-bold uppercase text-[10px] tracking-widest text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">Cancel</button>
                    <button onClick={handleSubmit} disabled={isSubmitting} className="bg-rose-600 hover:bg-rose-500 text-white px-6 py-2.5 rounded-sm font-black uppercase text-[10px] tracking-widest shadow-[4px_4px_0px_0px_#020617] active:translate-y-0.5 active:shadow-none transition-all border border-transparent disabled:opacity-50 flex items-center gap-2">
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Send Challenge</>}
                    </button>
                </div>
            </div>
        </div>
    );
};