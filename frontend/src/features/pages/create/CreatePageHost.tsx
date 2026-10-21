import { lazy, Suspense } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { buildLoginRedirectPath } from '../../../utils/authRedirect';
import { BUSINESS_PARAM, businessFromParam, CLAIM_PARAM, CREATE_PARAM, DRAW_PARAM, FROM_PARAM, fromParam, kindFromParam, refFromParam, withoutCreate } from './entry';

const StartSheet = lazy(() => import('./StartSheet').then(module => ({ default: module.StartSheet })));
const ClaimSheet = lazy(() => import('./ClaimSheet').then(module => ({ default: module.ClaimSheet })));

/**
 * Mounted once in the app shell: opens the start sheet over the current page when the address says `?create=`,
 * and the claim sheet for `?claim=club-307`. Closing drops the keys, so Back and shared links behave.
 */
export function CreatePageHost() {
  const location = useLocation();
  const navigate = useNavigate();
  const { status } = useAuth();
  const params = new URLSearchParams(location.search);
  const create = params.get(CREATE_PARAM), claim = refFromParam(params.get(CLAIM_PARAM));
  if (!create && !claim) return null;
  if (status === 'bootstrapping') return null;
  if (status !== 'authenticated') return <Navigate to={buildLoginRedirectPath(location.pathname, location.search, location.hash)} replace />;
  const from = fromParam(params.get(FROM_PARAM));
  const close = () => navigate({ pathname: location.pathname, search: withoutCreate(location.search), hash: location.hash }, { replace: true });
  const toClaim = (ref: { type: 'club' | 'organization'; id: number }) => {
    const next = new URLSearchParams(withoutCreate(location.search));
    next.set(CLAIM_PARAM, `${ref.type}-${ref.id}`); next.set(FROM_PARAM, from);
    navigate({ pathname: location.pathname, search: `?${next}`, hash: location.hash }, { replace: true });
  };
  return (
    <Suspense fallback={null}>
      {claim ? <ClaimSheet key={`${claim.type}-${claim.id}`} pageRef={claim} onClose={close} />
        : <StartSheet kind={kindFromParam(create)} business={businessFromParam(params.get(BUSINESS_PARAM))} from={from} draw={params.get(DRAW_PARAM) === '1'} onClose={close} onClaim={toClaim} />}
    </Suspense>
  );
}
