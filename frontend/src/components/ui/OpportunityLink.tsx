import { ArrowRight, ChevronRight, BriefcaseBusiness, HeartHandshake, ShoppingBag, LandPlot, Shirt, MapPin, Coins } from 'lucide-react';
import { Link } from 'react-router-dom';
import { isAndroidApp } from '../../android/bridge';

const categories = {
    store: { label: 'Store', icon: ShoppingBag },
    stadiums: { label: 'Stadiums', icon: LandPlot },
    campaigns: { label: 'Fundraising & campaigns', icon: HeartHandshake },
    jobs: { label: 'Roles', icon: BriefcaseBusiness },
};

export function OpportunityLink({ kind, to, description, preview = false, compact = false }: {
    kind: keyof typeof categories; to: string; description: string; preview?: boolean; compact?: boolean;
}) {
    const { label, icon: Icon } = categories[kind];
    preview = preview && !isAndroidApp;
    if (compact) {
        const compactCategories = {
            store: { label: 'Club Store', icon: Shirt },
            stadiums: { label: 'Venues & pitches', icon: MapPin },
            campaigns: { label: 'Fundraising', icon: Coins },
            jobs: { label: 'Open roles', icon: BriefcaseBusiness },
        };
        const { label: compactLabel, icon: CompactIcon } = compactCategories[kind];
        return <Link to={to} className={`opportunity-link opportunity-link--${kind} home-opportunity-link`}>
            <span className="home-opportunity-icon"><CompactIcon size={16} strokeWidth={1.6} aria-hidden="true" /></span>
            <span className="home-opportunity-copy"><span className="home-opportunity-title">{compactLabel}</span><span className="opportunity-link__description">{description}</span></span>
            <ChevronRight size={14} strokeWidth={1.6} aria-hidden="true" className="home-opportunity-chevron" />
        </Link>;
    }
    return <Link to={to} className={`opportunity-link opportunity-link--${kind}`}>
        <span className="flex items-center gap-2 text-xs font-semibold"><Icon className="h-4 w-4 shrink-0" /><span className="flex-1">{label}</span>{preview ? <span className="rounded-full border border-current/30 px-1.5 py-0.5 text-[8px] uppercase tracking-wide">Preview</span> : <ArrowRight className="h-3.5 w-3.5 shrink-0" />}</span>
        <span className="opportunity-link__description mt-2 block text-xs leading-5">{description}</span>
    </Link>;
}
