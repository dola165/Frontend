import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { registrationRoles, type RegistrationRole } from '../../utils/registrationRoles';
import './account-role-selector.css';

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
            <p id={`${id}-hint`} className="account-role-hint">{t('authRoles.hint')}</p>
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
                                <span id={`${id}-${role}-label`} className="account-role-name">{t(`authRoles.${key}`)}</span>
                                <span id={`${id}-${role}-description`} className="account-role-description">{t(`authRoles.${key}Description`)}</span>
                            </span>
                        </label>
                    );
                })}
            </div>
            {value === 'PARENT' && <p className="account-role-parent-hint">{t('authRoles.parentHint')}</p>}
        </fieldset>
    );
};
