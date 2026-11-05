import { List, ListRow, Panel, Section } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { connectedWorkspaces } from '../../../components/layout/connectedWorkspaces';
import { coachHubEn } from '../../../locales/workspaceDesign';
import { useCopy } from '../../../locales/useCopy';

/** Personal workspaces outside this club (referee, family, agent), kept one step away. */
export function OtherWork({ className }: { className?: string }) {
    const { user } = useAuth();
    const copy = useCopy('coachHub', coachHubEn);
    const links = connectedWorkspaces(user?.navigationCapabilities).filter(w => w.group === 'Personal work' && w.key.split(':')[0] !== 'club.work');
    if (!links.length) return null;
    return <Section className={className} title={copy('otherWork')}>
        <Panel flush><List label={copy('otherWork')}>{links.map(link => <ListRow key={link.key} to={link.path} title={link.label} meta={link.description} />)}</List></Panel>
    </Section>;
}
