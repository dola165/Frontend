import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { getClubAccentStyle, getJoinPolicyClasses } from './clubDirectoryMappings';
import type { ClubProfile } from './clubDirectoryTypes';

interface ClubDirectoryIdentityProps {
    club: ClubProfile;
    variant?: 'list' | 'card';
}

export const ClubDirectoryIdentity = ({ club, variant = 'list' }: ClubDirectoryIdentityProps) => {
    const logoUrl = resolveMediaUrl(club.logoUrl);
    const accentStyle = getClubAccentStyle(club);
    const isCard = variant === 'card';

    return (
        <div className={isCard ? '-mx-4 -mt-4 min-w-0' : 'min-w-0'}>
            {isCard && (
                <Link to={`/clubs/${club.id}`} aria-label={`Open ${club.name}`} className="group block rounded-t-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16a34a] focus-visible:ring-inset">
                    <div className="relative h-24 overflow-hidden rounded-t-xl border-b border-[#ffffff1f]" style={{ backgroundColor: accentStyle.backgroundColor }}>
                        {logoUrl && <img src={logoUrl} alt="" aria-hidden="true" className="absolute right-4 bottom-1 h-20 w-20 object-contain opacity-35 transition-transform group-hover:scale-105" />}
                        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${accentStyle.backgroundColor} 0%, ${accentStyle.borderColor} 100%)`, opacity: 0.82 }} />
                        <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-2">
                            {club.isOfficial ? <span className="rounded-full bg-black/25 px-2 py-1 text-[9px] font-semibold text-white">Official</span> : <span />}
                            <div className="flex items-center gap-1.5">
                                <span className="rounded-full bg-black/25 px-2 py-1 text-[9px] font-semibold text-white">{club.type}</span>
                                {club.joinPolicy && <span className={`rounded-full border border-white/10 px-2 py-1 text-[9px] font-semibold ${getJoinPolicyClasses(club.joinPolicy)}`}>{club.joinPolicy.replace(/_/g, ' ')}</span>}
                            </div>
                        </div>
                        {!logoUrl && <span className="absolute inset-0 flex items-center justify-center text-4xl font-black tracking-[0.18em] transition-transform group-hover:scale-105" style={{ color: accentStyle.color, opacity: 0.72 }}>{club.name.substring(0, 2).toUpperCase()}</span>}
                    </div>
                </Link>
            )}
            <div className={isCard ? 'px-4 pt-4' : ''}>
                <div className="flex items-start gap-3">
                    {!isCard && <Link to={`/clubs/${club.id}`} aria-label={`Open ${club.name}`} className="block h-12 w-12 shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16a34a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#16181d]">
                        <div
                            className="flex h-12 w-12 items-center justify-center rounded-lg border border-[#ffffff0d] bg-[#0f1117] text-sm font-semibold text-[#f4f4f5]"
                            style={logoUrl ? undefined : accentStyle}
                        >
                            {logoUrl ? <img src={logoUrl} alt={`${club.name} logo`} className="h-full w-full rounded-lg object-cover" /> : club.name.substring(0, 2).toUpperCase()}
                        </div>
                    </Link>}
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <Link to={`/clubs/${club.id}`} className="break-words text-sm font-semibold leading-5 text-[#f4f4f5] hover:text-[#16a34a]">{club.name}</Link>
                        {!isCard && club.isOfficial && <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#16a34a]"><ShieldCheck className="h-3.5 w-3.5" />Official</span>}
                        {!isCard && club.joinPolicy && (
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-medium ${getJoinPolicyClasses(club.joinPolicy)}`}>
                                {club.joinPolicy.replace(/_/g, ' ')}
                            </span>
                        )}
                    </div>
                    {!isCard && <p className="mt-1 text-[11px] font-medium text-[#a1a1aa]">{club.type}</p>}
                </div>
            </div>
            </div>
        </div>
    );
};
