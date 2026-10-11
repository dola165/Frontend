import { Link } from 'react-router-dom';
import { Contact } from 'lucide-react';
import { RoleIcon } from '../../../profiles/person/RoleIcon';
import { usePersonProfile } from '../../../profiles/person/usePersonProfile';
import { roleLabel } from '../../../roles/domain';
import { useWorldCopy } from '../../copy';
import { Crest } from '../../Crest';
import { PopoverPill } from '../../directory/DirectoryFilters';
import '../../peek/peek.css';
import './people.css';

/** Your own card, as People shows you to others: your face, your roles, and where to change them. */
function OwnCard({ userId, referee }: { userId: number; referee: boolean }) {
    const t = useWorldCopy();
    const { profile, roles, status } = usePersonProfile(userId);
    if (status === 'loading') return <p className="gk-faint">{t('Loading…')}</p>;
    if (!profile) return <p className="gk-faint">{t('Your profile could not load.')}</p>;
    const name = profile.fullName || profile.username;
    return (
        <div className="gk-your-card">
            <div className="gk-peek-person">
                <Crest src={profile.avatarUrl} name={name} size={48} round />
                <div className="gk-peek-person__name">
                    <strong>{name}</strong>
                    <ul className="gk-peek-roles" aria-label={t('Football roles')}>{roles.map(role => <li key={role}><RoleIcon role={role} size="sm" />{t(roleLabel(role))}</li>)}</ul>
                </div>
            </div>
            <p className="gk-faint">{t('This is how People shows you to others.')}</p>
            <div className="gk-peek-actions">
                <Link className="gk-people-act" to="/account/roles" data-close>{t('Edit roles')}</Link>
                <Link className="gk-people-act" to={`/profile/${userId}`} data-close>{t('Full profile')}</Link>
                {referee && <Link className="gk-people-act" to="/referees/me" data-close>{t('Mark when you’re free')}</Link>}
            </div>
        </div>
    );
}

/** "Your card": a pill in People's header that opens your own card. */
export function YourCard({ userId, referee }: { userId: number; referee: boolean }) {
    const t = useWorldCopy();
    return (
        <PopoverPill align="end" pressed={false} label={<><Contact aria-hidden="true" />{t('Your card')}</>}>
            <OwnCard userId={userId} referee={referee} />
        </PopoverPill>
    );
}
