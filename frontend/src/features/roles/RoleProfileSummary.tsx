import { rolePresentation, type RoleProfile } from './domain';

export const RoleProfileSummary = ({ profiles }: { profiles: RoleProfile[] }) => {
    const details = profiles.filter(profile => profile.headline || profile.specialties || profile.qualifications || profile.serviceArea);
    if (!details.length) return null;
    return <section aria-label="Football roles" className="grid gap-3 sm:grid-cols-2">
        {details.map(profile => {
            const presentation = rolePresentation[profile.role];
            if (!presentation) return null;
            return <article key={profile.role} className="rounded-xl border border-[var(--club-theme-border-subtle)] bg-[var(--club-card)] p-5">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: presentation.tone }}>{presentation.label}{!profile.published ? ' · Only you' : ''}</p>
                {profile.headline && <h3 className="mt-2 text-lg font-semibold">{profile.headline}</h3>}
                {profile.specialties && <div className="mt-3"><p className="text-xs text-[var(--club-theme-text-secondary)]">{presentation.focus}</p><p className="mt-1 whitespace-pre-wrap text-sm">{profile.specialties}</p></div>}
                {profile.qualifications && <div className="mt-3"><p className="text-xs text-[var(--club-theme-text-secondary)]">Qualifications · self-reported</p><p className="mt-1 whitespace-pre-wrap text-sm">{profile.qualifications}</p></div>}
                {profile.serviceArea && <p className="mt-3 text-sm text-[var(--club-theme-text-secondary)]">{profile.serviceArea}</p>}
            </article>;
        })}
    </section>;
};
