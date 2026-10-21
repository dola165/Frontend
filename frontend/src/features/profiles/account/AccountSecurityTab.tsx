import { BadgeCheck, KeyRound, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';
import { TwoFactorSettings } from '../../twoFactor/TwoFactorSettings';
import { useAccountCopy } from './accountCopy';
import { Field, Section } from './AccountFields';
import { btnPrimaryClass, btnSecondaryClass, fmt, inputClass, insetClass } from './accountModel';
import type { AccountCenter } from './useAccountCenter';

type SecurityProps = Pick<AccountCenter, 'passwordForm' | 'setPasswordForm' | 'changingPassword' | 'changePassword'
    | 'sendingVerification' | 'resendVerification' | 'refreshOverview'> & {
    account: NonNullable<AccountCenter['account']>; securityExtensions: boolean;
};

export const AccountSecurityTab = ({ account, passwordForm, setPasswordForm, changingPassword, changePassword,
    sendingVerification, resendVerification, refreshOverview, securityExtensions }: SecurityProps) => {
    const copy = useAccountCopy();
    return (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <Section title={copy("Email And Password")} description={copy("Recovery and password flows in one operational section.")}>
                <div className={`${insetClass} px-4 py-4`}>
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--fc-text-primary)]">
                                {account.emailVerified ? <BadgeCheck className="h-4 w-4 text-[color:var(--fc-accent)]" /> : <Mail className="h-4 w-4 text-[color:var(--fc-state-warning)]" />}
                                <span>{account.emailVerified ? copy("Email verified") : copy("Email verification pending")}</span>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--fc-text-secondary)]">
                                {account.emailVerified ? copy(`Verified for ${account.email}${fmt(account.emailVerifiedAt) ? ` on ${fmt(account.emailVerifiedAt)}` : '.'}`, `დადასტურებულია: ${account.email}${fmt(account.emailVerifiedAt) ? ` · ${fmt(account.emailVerifiedAt)}` : ''}`) : copy(`We have not confirmed ${account.email} yet.`, `${account.email} ჯერ არ არის დადასტურებული.`)}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => void resendVerification()}
                            disabled={account.emailVerified || sendingVerification}
                            className={account.emailVerified ? `${btnSecondaryClass} opacity-50` : btnSecondaryClass}
                        >
                            {sendingVerification ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                            {account.emailVerified ? copy("Verified") : copy("Resend Email")}
                        </button>
                    </div>
                </div>

                <div className={`mt-4 ${insetClass} px-4 py-4`}>
                    <div className="flex items-start gap-3">
                        {account.passwordLoginEnabled ? <ShieldCheck className="mt-0.5 h-5 w-5 text-[color:var(--fc-accent)]" /> : <Lock className="mt-0.5 h-5 w-5 text-[color:var(--fc-state-warning)]" />}
                        <div>
                            <h3 className="text-sm font-semibold text-[color:var(--fc-text-primary)]">{copy("Password State")}</h3>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--fc-text-secondary)]">
                                {account.passwordLoginEnabled ? copy("Changing your password signs you out on every device, including this one. Sign in again with your new password afterward.") : copy("This account currently relies on a linked provider. Use the password reset route for this email when you are ready to add a password.")}
                            </p>
                        </div>
                    </div>
                </div>

                {account.passwordLoginEnabled && (
                    <form onSubmit={changePassword} className="mt-4 grid gap-4">
                        <Field label={copy("Current Password")}>
                            <input type="password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))} className={inputClass} />
                        </Field>
                        <div className="grid gap-4 md:grid-cols-2">
                            <Field label={copy("New Password")}>
                                <input type="password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))} className={inputClass} />
                            </Field>
                            <Field label={copy("Confirm Password")}>
                                <input type="password" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))} className={inputClass} />
                            </Field>
                        </div>
                        <div className="flex justify-end">
                            <button type="submit" disabled={changingPassword} className={btnPrimaryClass}>
                                {changingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                                {copy("Change Password")}
                            </button>
                        </div>
                    </form>
                )}
            </Section>

            {securityExtensions && <Section title={copy("Authenticator Security")}>
                <TwoFactorSettings accountId={account.id} passwordLoginEnabled={account.passwordLoginEnabled} onCredentialsChanged={refreshOverview} />
            </Section>}
        </div>
    );
};
