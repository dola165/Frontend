import { ArrowRight, BriefcaseBusiness, HeartHandshake, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';

const categories = {
    store: { label: 'Store', icon: ShoppingBag },
    campaigns: { label: 'Fundraising & campaigns', icon: HeartHandshake },
    jobs: { label: 'Jobs & volunteering', icon: BriefcaseBusiness },
};

export function OpportunityLink({ kind, to, description, preview = false }: {
    kind: keyof typeof categories; to: string; description: string; preview?: boolean;
}) {
    const { label, icon: Icon } = categories[kind];
    return <Link to={to} className={`opportunity-link opportunity-link--${kind}`}>
        <span className="flex items-center gap-2 text-xs font-semibold"><Icon className="h-4 w-4 shrink-0" /><span className="flex-1">{label}</span>{preview ? <span className="rounded-full border border-current/30 px-1.5 py-0.5 text-[8px] uppercase tracking-wide">Preview</span> : <ArrowRight className="h-3.5 w-3.5 shrink-0" />}</span>
        <span className="opportunity-link__description mt-2 block text-xs leading-5">{description}</span>
    </Link>;
}
