import { List, ListRow, Panel, Section } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { connectedWorkspaces } from '../../../components/layout/connectedWorkspaces';

/** Personal workspaces outside this club (referee, family, agent), kept one step away. */
export function OtherWork() {
    const { user } = useAuth();
    const links = connectedWorkspaces(user?.navigationCapabilities).filter(w => w.group === 'Personal work' && w.key.split(':')[0] !== 'club.work');
    if (!links.length) return null;
    return <Section title="Your other work" action={{ label: 'All workspaces', to: '/workspaces' }}>
        <Panel flush><List label="Your other work">{links.map(link => <ListRow key={link.key} to={link.path} title={link.label} meta={link.description} />)}</List></Panel>
    </Section>;
}
