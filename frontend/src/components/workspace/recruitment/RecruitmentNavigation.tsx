import { ArrowUpRight, CalendarDays, ClipboardList, Shield, Users } from 'lucide-react';
import { useRecruitmentCopy } from '../../../locales/recruitmentDesign';

export interface RecruitmentNavigationProps {
    active: 'applications' | 'tryouts';
    onOpenApplications?: () => void;
    onOpenTryouts?: () => void;
    onOpenPlayers?: () => void;
    onOpenSquads?: () => void;
}

export const RecruitmentNavigation = ({ active, onOpenApplications, onOpenTryouts, onOpenPlayers, onOpenSquads }: RecruitmentNavigationProps) => {
    const r = useRecruitmentCopy();
    const steps = [
        { id: 'applications', label: r('applications'), detail: r('applicationsStep'), icon: ClipboardList, action: onOpenApplications },
        { id: 'tryouts', label: r('tryouts'), detail: r('tryoutsStep'), icon: CalendarDays, action: onOpenTryouts },
        { id: 'players', label: r('players'), detail: r('playersStep'), icon: Users, action: onOpenPlayers },
        { id: 'squads', label: r('squads'), detail: r('squadsStep'), icon: Shield, action: onOpenSquads },
    ].filter((step) => step.id === active || step.action);
    if (steps.length < 2) return null;
    return <nav className="rc-navigation" aria-label={r('workflow')}>
        {steps.map(({ id, label, detail, icon: Icon, action }) => <button type="button" key={id} onClick={action} aria-current={id === active ? 'page' : undefined}>
            <Icon size={17} /><span><strong>{label}</strong><small>{detail}</small></span>{id !== active && <ArrowUpRight size={14} />}
        </button>)}
    </nav>;
};
