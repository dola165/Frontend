import { lazy, Suspense } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { Dialog } from '../../../design/Dialog';
import { Button } from '../../../design/primitives';
import { buildLoginRedirectPath } from '../../../utils/authRedirect';
import { usePagesCopy } from '../copy';
import { BUSINESS_PARAM, businessFromParam, CREATE_PARAM, DRAW_PARAM, FROM_PARAM, fromParam, kindFromParam, withoutCreate } from './entry';
import { isAdult } from '../../../utils/age';
import { BirthDateStep } from './BirthDateStep';

const StartSheet = lazy(() => import('./StartSheet').then(module => ({ default: module.StartSheet })));

/**
 * Mounted once in the app shell: opens the start sheet over the current page when the address says `?create=`.
 * Closing drops the keys, so Back and shared links behave. Pages are for adults: someone under 18 who follows such a
 * link is told so instead, and an account without a birth date is asked for it first.
 */
export function CreatePageHost() {
  const location = useLocation();
  const navigate = useNavigate();
  const { status, user } = useAuth();
  const t = usePagesCopy();
  const params = new URLSearchParams(location.search);
  const create = params.get(CREATE_PARAM);
  if (!create) return null;
  if (status === 'bootstrapping') return null;
  if (status !== 'authenticated') return <Navigate to={buildLoginRedirectPath(location.pathname, location.search, location.hash)} replace />;
  // Opened from the welcome's "What kind?": Not now goes back to it, so nobody is left on a page they did not pick.
  const rest = withoutCreate(location.search);
  const search = params.get(FROM_PARAM) === 'welcome' ? `${rest ? `${rest}&` : '?'}welcome=business` : rest;
  const close = () => navigate({ pathname: location.pathname, search, hash: location.hash }, { replace: true });
  // Opening a known page from the sheet leaves the welcome behind too: Back from that page returns here, not to it.
  const leave = () => navigate({ pathname: location.pathname, search: rest, hash: location.hash }, { replace: true });
  // A missing birth date is not adult: asked for once, then the sheet or the answer below.
  if (!user?.dob) return <BirthDateStep onClose={close} />;
  if (!isAdult(user.dob)) return <Dialog open size="sm" title={t('Pages are for adults')} description={t('Ask an adult at your club to create it and invite you.')} onClose={close}
    footer={<Button variant="primary" onClick={close}>{t('Close')}</Button>} />;
  return (
    <Suspense fallback={null}>
      <StartSheet kind={kindFromParam(create)} business={businessFromParam(params.get(BUSINESS_PARAM))} from={fromParam(params.get(FROM_PARAM))} draw={params.get(DRAW_PARAM) === '1'} onClose={close} onLeave={leave} />
    </Suspense>
  );
}
