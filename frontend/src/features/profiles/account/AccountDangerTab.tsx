import { TriangleAlert } from 'lucide-react';
import { useAccountCopy } from './accountCopy';
import { Section } from './AccountFields';

export const AccountDangerTab = () => {
    const copy = useAccountCopy();
    return (
        <Section title={copy("Danger Zone")}>
            <div className="rounded-xl border border-[color:var(--fc-state-danger)]/30 bg-[color:var(--fc-state-danger)]/10 px-5 py-4">
                <div className="flex items-start gap-3">
                    <TriangleAlert className="mt-0.5 h-5 w-5 text-[color:var(--fc-state-danger)]" />
                    <div>
                        <p className="text-sm font-semibold text-[color:var(--fc-state-danger)]">
                            {copy("Account deletion is not available on this page.")}
                        </p>
                    </div>
                </div>
            </div>
        </Section>
    );
};
