import { lazy, Suspense } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { buildLoginRedirectPath } from '../../../utils/authRedirect';
import { BUSINESS_PARAM, businessFromParam, CREATE_PARAM, DRAW_PARAM, FROM_PARAM, fromParam, kindFromParam, withoutCreate } from './entry';

const StartSheet = lazy(() => import('./StartSheet').then(module => ({ default: module.StartSheet })));

/**
 * Mounted once in the app shell: opens the start sheet over the current page when the address says `?create=`.
 * Closing drops the keys, so Back and shared links behave.
 */
export function CreatePageHost() {
  const location = useLocation();
  const navigate = useNavigate();
  const { status } = useAuth();
  const params = new URLSearchParams(location.search);
  const create = params.get(CREATE_PARAM);
  if (!create) return null;
  if (status === 'bootstrapping') return null;
  if (status !== 'authenticated') return <Navigate to={buildLoginRedirectPath(location.pathname, location.search, location.hash)} replace />;
  const close = () => navigate({ pathname: location.pathname, search: withoutCreate(location.search), hash: location.hash }, { replace: true });
  return (
    <Suspense fallback={null}>
      <StartSheet kind={kindFromParam(create)} business={businessFromParam(params.get(BUSINESS_PARAM))} from={fromParam(params.get(FROM_PARAM))} draw={params.get(DRAW_PARAM) === '1'} onClose={close} />
    </Suspense>
  );
}
