import { Navigate, useLocation } from 'react-router-dom';

/** Compatibility entry point; creation now has one shared flow. */
export const CreateClubPage = () => {
  const location = useLocation();
  return <Navigate to="/organizations/create?kind=CLUB" state={location.state} replace />;
};
