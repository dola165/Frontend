import { BadgeCheck } from 'lucide-react';
import { GoogleProviderSettings } from '../../providers/GoogleProviderSettings';
import { useAccountCopy } from './accountCopy';
import { DetailRow, Section } from './AccountFields';
import { fmt, surfaceClass, type Account } from './accountModel';

const providerLabel = (provider: string) => (provider === 'google' ? 'Google' : provider.charAt(0).toUpperCase() + provider.slice(1));

export const AccountLinkedAccountsTab = ({ account, securityExtensions, refreshOverview }: {
    account: Account; securityExtensions: boolean; refreshOverview: () => void;
}) => {
    const copy = useAccountCopy();
    return (
        <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
            <Section title={copy("Capability Summary")}>
                <DetailRow label={copy("Password Sign-In")} value={account.passwordLoginEnabled ? copy("Enabled") : copy("Not configured")} />
                <DetailRow label={copy("External Providers")} value={account.linkedAccounts.length > 0 ? copy(`${account.linkedAccounts.length} connected`, `${account.linkedAccounts.length} დაკავშირებულია`) : copy("None")} />
            </Section>

            <Section title={copy("Linked Providers")} description={copy("Manage the sign-in methods attached to this account.")}>
                {securityExtensions && <GoogleProviderSettings accountId={account.id} onCredentialsChanged={refreshOverview} />}
                {account.linkedAccounts.some(linked => !securityExtensions || linked.provider !== 'google') && (
                    <div className={surfaceClass}>
                        <div className="divide-y divide-[color:var(--fc-border)]">
                            {account.linkedAccounts.filter(linked => !securityExtensions || linked.provider !== 'google').map((linked) => (
                                <article key={`${linked.provider}-${linked.linkedAt || 'current'}`} className="flex items-center justify-between gap-4 px-5 py-4">
                                    <div>
                                        <p className="text-sm font-semibold text-[color:var(--fc-text-primary)]">{providerLabel(linked.provider)}</p>
                                        <p className="mt-1 text-sm text-[color:var(--fc-text-secondary)]">{linked.linkedAt ? copy(`Linked ${fmt(linked.linkedAt)}`, `დაკავშირების თარიღი: ${fmt(linked.linkedAt)}`) : copy("Linked account")}</p>
                                    </div>
                                    <BadgeCheck className="h-5 w-5 text-[color:var(--fc-accent)]" />
                                </article>
                            ))}
                        </div>
                    </div>
                )}

            </Section>
        </div>
    );
};
