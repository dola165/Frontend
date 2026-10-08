import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import './workflow-ui.css';

export function RecordFacts({ items }: { items: { label: string; value: ReactNode; icon?: LucideIcon }[] }) {
    return <dl className="gk-record-facts">{items.map(({ label, value, icon: Icon }) => <div key={label}>
        <dt>{Icon && <Icon size={15} aria-hidden="true" />}{label}</dt><dd>{value}</dd>
    </div>)}</dl>;
}
