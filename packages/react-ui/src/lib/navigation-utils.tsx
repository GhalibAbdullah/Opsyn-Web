import { useNavigate, useSearchParams } from 'react-router-dom';

import { isNil } from '@activepieces/shared';

import { authenticationSession } from './authentication-session';
import { useEmbedding } from '../components/embed-provider';

export const useNewWindow = () => {
  const { embedState } = useEmbedding();
  const navigate = useNavigate();
  if (embedState.isEmbedded) {
    return (route: string, searchParams?: string) =>
      navigate({
        pathname: route,
        search: searchParams,
      });
  } else {
    return (route: string, searchParams?: string) =>
      window.open(
        `${route}${searchParams ? '?' + searchParams : ''}`,
        '_blank',
        'noopener noreferrer',
      );
  }
};

export const FROM_QUERY_PARAM = 'from';
/**State param is for oauth2 flow, it is used to redirect to the page after login*/
export const STATE_QUERY_PARAM = 'state';
export const LOGIN_QUERY_PARAM = 'activepiecesLogin';
export const PROVIDER_NAME_QUERY_PARAM = 'providerName';

export const useDefaultRedirectPath = () => {
  return '/flows';
};

export const useRedirectAfterLogin = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultRedirectPath = useDefaultRedirectPath();
  const from = searchParams.get(FROM_QUERY_PARAM);
  
  return () => {
    // If there's a specific 'from' parameter, use it
    if (from) {
      navigate(from);
      return;
    }
    
    // Otherwise, check if user has a project
    const projectId = authenticationSession.getProjectId();
    if (isNil(projectId)) {
      // No project - redirect to dashboard to create one
      navigate('/dashboard');
    } else {
      // Has project - use default redirect path
      navigate(defaultRedirectPath);
    }
  };
};
