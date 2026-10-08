import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { registrationRoles, type RegistrationRole } from '../../utils/registrationRoles';
import './account-role-selector.css';

const additions: Partial<Record<RegistrationRole, { label: string; description: string }>> = {
    COACH: { label: 'Coach', description: 'Build your coaching profile, including specialist coaching. Club access follows an approved appointment.' },
    REFEREE: { label: 'Referee', description: 'Share your experience and qualifications. Match appointments are assigned separately.' },
    AGENT: { label: 'Agent', description: 'Create your professional profile and manage approved player engagements. Adults only.' },
    VENUE_MANAGER: { label: 'Venue manager', description: 'Create or join an organization to manage its facilities. Adults only.' },
};

interface AccountRoleSelectorProps {
    value: RegistrationRole;
    onChange: (role: RegistrationRole) => void;
    disabled?: boolean;
}

export const AccountRoleSelector = ({ value, onChange, disabled = false }: AccountRoleSelectorProps) => {
    const { t } = useTranslation();
    const id = useId();

    return (
        <fieldset className="account-role-selector" disabled={disabled} aria-describedby={`${id}-hint`}>
            <legend>{t('authRoles.label')}</legend>
            <p id={`${id}-hint`} className="account-role-hint">Choose a starting profile. You can add other football roles after signup using the same account.</p>
            <div className="account-role-options">
                {registrationRoles.map((role) => {
                    const key = role.toLowerCase();
                    return (
                        <label className="account-role-option" key={role}>
                            <input
                                type="radio"
                                name={`${id}-role`}
                                value={role}
                                checked={value === role}
                                onChange={() => onChange(role)}
                                aria-labelledby={`${id}-${role}-label`}
                                aria-describedby={`${id}-${role}-description`}
                            />
                            <span className="account-role-copy">
                                <span id={`${id}-${role}-label`} className="account-role-name">{t(`authRoles.${key}`, additions[role]?.label ?? role)}</span>
                                <span id={`${id}-${role}-description`} className="account-role-description">{t(`authRoles.${key}Description`, additions[role]?.description ?? '')}</span>
                            </span>
                        </label>
                    );
                })}
            </div>
            {value === 'PARENT' && <p className="account-role-parent-hint">{t('authRoles.parentHint')}</p>}
        </fieldset>
    );
};
