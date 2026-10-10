import type { ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { accessibleClubs, type ClubAccess } from './clubAccess';
import './my-club-gallery.css';
import { ConnectedWork } from './ConnectedWork';

/**
 * `/my-club`: a person with one club goes straight to it; without a club they see `children`.
 * Someone still connected to several clubs (from before the one-club rule) chooses here; navigation always says "My Club".
 */
export function ClubAccessEntry({ children }: { children: ReactNode }) {
  const { user, sessionId } = useAuth();
  const clubs = accessibleClubs(user?.navigationCapabilities);
  if (clubs.length === 1) return <Navigate to={`/clubs/${clubs[0].id}`} replace />;
  return clubs.length > 1 ? <ClubGallery key={sessionId} clubs={clubs} /> : children;
}
function ClubGallery({ clubs }: { clubs: ClubAccess[] }) {
  const { t } = useTranslation();
  return <main className="my-club-gallery"><header><h1>{t('experience.clubs.title', 'Your clubs')}</h1><p>{t('experience.clubs.description', 'Choose a club to view its profile or open the workspace for your responsibilities.')}</p></header><ConnectedWork /><div>{clubs.map(club => <article key={club.id}><div className="my-club-card-cover"><Shield size={42} /></div><section><h2>{club.name}</h2><p>{club.relationships.join(' · ')}</p><div><Link to={`/clubs/${club.id}`}>{t('experience.clubs.profile', 'View profile')}</Link>{club.canOpenWorkspace && <Link to={`/clubs/${club.id}/workspace`}>{t('experience.clubs.workspace', 'Open workspace')}</Link>}</div></section></article>)}</div></main>;
}
