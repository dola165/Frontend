import { Building2, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MediaImage } from '../../components/ui/MediaImage';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import type { Venue } from './api';
import './venue-organizations.css';

export function VenueOrganizations({ venue }: { venue: Venue }) {
    if (!venue.organizations?.length) return null;
    return <section className="venue-organizations" aria-label="Venue organizations">
        {venue.organizations.map(organization => {
            const owns = organization.relationships.includes('OWNS');
            const operates = organization.relationships.includes('OPERATES');
            const profile = organization.clubId ? `/clubs/${organization.clubId}?tab=facilities` : `/organizations/${organization.id}?tab=venues`;
            return <article key={organization.id} className="venue-organization">
                <Link className="venue-organization-identity" to={profile}>
                    <span className="venue-organization-logo" aria-hidden="true">{organization.logoUrl
                        ? <MediaImage src={resolveMediaUrl(organization.logoUrl)} alt="" /> : <Building2 size={24} />}</span>
                    <span><small>{owns ? operates ? 'Listed owner and operator' : 'Listed owner' : 'Operated by'}</small>
                        <strong>{organization.displayName}</strong>
                        <span className="venue-organization-hint">Explore {organization.clubId ? 'club facilities' : 'the organization’s venues'}</span></span>
                    <ChevronRight size={19} aria-hidden="true" />
                </Link>
                <div className="venue-organization-actions">
                    <Link className="venue-button" to={profile}>{organization.clubId ? 'View club facilities' : 'View all venues'}</Link>
                    {!organization.clubId && <Link className="venue-button" to={`/organizations/${organization.id}?tab=prices`}>Compare prices</Link>}
                </div>
                {owns && organization.declared && <p className="venue-organization-source">Ownership relationship provided by the organization.</p>}
            </article>;
        })}
    </section>;
}
