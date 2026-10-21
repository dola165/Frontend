import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import type { PageKind } from '../model/kinds';
import { createHref } from './entry';

const BUSINESS_TYPES = new Set(['COMPANY', 'SPONSOR', 'MEDIA', 'HEALTHCARE']);

/**
 * The old addresses (`/organizations/create?kind=…`, `/clubs/create`) open the start sheet over Home, so every
 * older link keeps working. An organiser set up from the Draw room keeps its way back there.
 */
export function CreateRedirect({ kind }: { kind?: PageKind }) {
  const location = useLocation();
  const [params] = useSearchParams();
  const requested = params.get('kind');
  const draw = Boolean((location.state as { drawRoom?: unknown } | null)?.drawRoom) || requested === 'TOURNAMENT_ORGANIZER';
  const target: PageKind | null = kind ?? (requested === 'CLUB' ? 'CLUB' : requested === 'PARTNER' ? 'FAN_CLUB' : requested && BUSINESS_TYPES.has(requested) ? 'BUSINESS' : draw ? 'PAGE' : null);
  return <Navigate to={createHref({ pathname: '/home', search: '' }, target, 'link', draw)} replace />;
}
