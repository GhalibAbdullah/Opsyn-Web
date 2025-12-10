import { Navigate, useLocation } from 'react-router-dom';

import { useAuthorization } from '@/hooks/authorization-hooks';
import { authenticationSession } from '@/lib/authentication-session';
import { determineDefaultRoute, determineProjectDefaultRoute } from '@/lib/utils';

export const DefaultRoute = () => {
  const token = authenticationSession.getToken();
  const location = useLocation();
  const { checkAccess } = useAuthorization();
  if (!token) {
    const searchParams = new URLSearchParams();
    searchParams.set('from', location.pathname + location.search);
    return (
      <Navigate
        to={`/sign-in?${searchParams.toString()}`}
        replace={true}
      ></Navigate>
    );
  }
  const isProjectRoute = location.pathname.startsWith('/projects/');
  const target = isProjectRoute
    ? determineProjectDefaultRoute(checkAccess)
    : determineDefaultRoute();
  return <Navigate to={target} replace></Navigate>;
};
