import axios, {
  AxiosError,
  AxiosRequestConfig,
  AxiosResponse,
  HttpStatusCode,
  isAxiosError,
} from 'axios';
import qs from 'qs';

import { authenticationSession } from '@/lib/authentication-session';
import { ApErrorParams, ErrorCode, isNil } from '@activepieces/shared';

export const API_BASE_URL =
  import.meta.env.MODE === 'cloud'
    ? 'https://cloud.activepieces.com'
    : window.location.origin;
export const API_URL = `${API_BASE_URL}/api`;

const disallowedRoutes = [
  '/v1/managed-authn/external-token',
  '/v1/authentication/sign-in',
  '/v1/authentication/sign-up',
  '/v1/authn/local/verify-email',
  '/v1/authn/federated/login',
  '/v1/authn/federated/claim',
  '/v1/otp',
  '/v1/human-input',
  '/v1/authn/local/reset-password',
  '/v1/user-invitations/accept',
  '/v1/webhooks',
  // Note: /v1/authentication/switch-project is NOT in disallowedRoutes, so it will be caught by the interceptor
];
//This is important to avoid redirecting to sign-in page when the user is deleted for embedding scenarios
const ignroedGlobalErrorHandlerRoutes = ['/v1/users/me'];
function isUrlRelative(url: string) {
  return !url.startsWith('http') && !url.startsWith('https');
}

function globalErrorHandler(error: AxiosError) {
  if (api.isError(error)) {
    const errorCode: ErrorCode | undefined = (
      error.response?.data as { code: ErrorCode }
    )?.code;
    if (
      errorCode === ErrorCode.SESSION_EXPIRED ||
      errorCode === ErrorCode.INVALID_BEARER_TOKEN
    ) {
      authenticationSession.logOut();
      console.log(errorCode);
      window.location.href = '/sign-in';
    }
  }
}

// Create a single axios instance with interceptors
const axiosInstance = axios.create();

// Add response interceptor to handle 403 errors for project routes (only once)
let interceptorAdded = false;
if (!interceptorAdded) {
  axiosInstance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      if (isAxiosError(error)) {
        const errorCode: ErrorCode | undefined = (
          error.response?.data as { code: ErrorCode }
        )?.code;
        const requestUrl = error.config?.url || '';
        const urlPath = requestUrl.replace(API_URL, '');
        
        // Handle 403 errors for project-related endpoints or switch-project endpoint
        if (
          (error.response?.status === 403 || 
           errorCode === ErrorCode.AUTHORIZATION || 
           errorCode === ErrorCode.PERMISSION_DENIED) &&
          !ignroedGlobalErrorHandlerRoutes.some(route => urlPath.startsWith(route))
        ) {
          // Don't redirect if user is on platform admin routes - platform admin doesn't require projects
          const isPlatformAdminRoute = window.location.pathname.startsWith('/platform');
          if (isPlatformAdminRoute) {
            // Let the error propagate normally - platform admin routes handle their own errors
            throw error;
          }
          
          const isProjectRoute = urlPath.includes('/projects/') || 
                                urlPath.includes('/v1/flows') ||
                                urlPath.includes('/v1/runs') ||
                                urlPath.includes('/v1/connections') ||
                                urlPath.includes('/v1/tables') ||
                                urlPath.includes('/v1/todos') ||
                                urlPath.includes('/v1/project-members') ||
                                urlPath.includes('/v1/authentication/switch-project');
          
          if (isProjectRoute) {
            const currentProjectId = authenticationSession.getProjectId();
            const projectIdFromUrl = urlPath.match(/\/projects\/([^\/]+)/)?.[1] || 
                                    error.config?.params?.projectId ||
                                    (error.config?.data && typeof error.config.data === 'string' ? JSON.parse(error.config.data)?.projectId : null);
            
            // If this is a switch-project call or we have a project ID, redirect
            if (urlPath.includes('/v1/authentication/switch-project') || currentProjectId || projectIdFromUrl) {
              console.log('User lost access to project (403), redirecting...');
              
              // Redirect immediately - don't wait
              const token = authenticationSession.getToken();
              
              // All users have access to their own platform admin settings
              // First check if user has any other projects
              axios.get<{ data: Array<{ id: string }> }>(
                `${API_URL}/v1/users/projects`,
                { 
                  params: { limit: 1 },
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                }
              ).then(async (projects) => {
                if (projects.data?.data && projects.data.data.length > 0) {
                  try {
                    await authenticationSession.switchToProject(projects.data.data[0].id);
                    window.location.href = `/projects/${projects.data.data[0].id}/flows`;
                  } catch (switchError) {
                    // If switch fails, redirect to dashboard
                    window.location.href = '/dashboard';
                  }
                } else {
                  // No projects - redirect to dashboard
                  window.location.href = '/dashboard';
                }
              }).catch(() => {
                // If we can't fetch projects, redirect to dashboard as fallback
                window.location.href = '/dashboard';
              });
            }
          }
        }
      }
      
      throw error;
    }
  );
  interceptorAdded = true;
}

function request<TResponse>(
  url: string,
  config: AxiosRequestConfig = {},
): Promise<TResponse> {
  const resolvedUrl = !isUrlRelative(url) ? url : `${API_URL}${url}`;
  const isApWebsite = resolvedUrl.startsWith(API_URL);
  const unAuthenticated = disallowedRoutes.some((route) =>
    resolvedUrl.replace(API_URL, '').startsWith(route),
  );

  return axiosInstance({
    url: resolvedUrl,
    ...config,
    headers: {
      ...config.headers,
      Authorization: getToken(
        unAuthenticated,
        isApWebsite,
        authenticationSession.getToken(),
      ),
    },
  })
    .then((response) =>
      config.responseType === 'blob'
        ? response.data
        : (response.data as TResponse),
    )
    .catch((error) => {
      if (
        isAxiosError(error) &&
        !ignroedGlobalErrorHandlerRoutes.includes(url)
      ) {
        globalErrorHandler(error);
      }
      throw error;
    });
}

function getToken(
  unAuthenticated: boolean,
  isApWebsite: boolean,
  token: string | null,
) {
  if (unAuthenticated || !isApWebsite) {
    return undefined;
  }
  if (isNil(token)) {
    return undefined;
  }
  return `Bearer ${token}`;
}

export type HttpError = AxiosError<unknown, AxiosResponse<unknown>>;

export const api = {
  isApError(error: unknown, errorCode: ErrorCode): error is HttpError {
    if (!isAxiosError(error)) {
      return false;
    }
    const responseData = error.response?.data as ApErrorParams;
    return responseData.code === errorCode;
  },
  isError(error: unknown): error is HttpError {
    return isAxiosError(error);
  },
  any: <TResponse>(url: string, config?: AxiosRequestConfig) =>
    request<TResponse>(url, config),
  get: <TResponse>(url: string, query?: unknown, config?: AxiosRequestConfig) =>
    request<TResponse>(url, {
      params: query,
      paramsSerializer: (params) => {
        return qs.stringify(params, {
          arrayFormat: 'repeat',
        });
      },
      ...config,
    }),
  delete: <TResponse>(
    url: string,
    query?: Record<string, string>,
    body?: unknown,
  ) =>
    request<TResponse>(url, {
      method: 'DELETE',
      params: query,
      data: body,
      paramsSerializer: (params) => {
        return qs.stringify(params, {
          arrayFormat: 'repeat',
        });
      },
    }),
  post: <TResponse, TBody = unknown, TParams = unknown>(
    url: string,
    body?: TBody,
    params?: TParams,
    headers?: Record<string, string>,
  ) =>
    request<TResponse>(url, {
      method: 'POST',
      data: body,
      headers: { 'Content-Type': 'application/json', ...headers },
      params: params,
    }),

  patch: <TResponse, TBody = unknown, TParams = unknown>(
    url: string,
    body?: TBody,
    params?: TParams,
  ) =>
    request<TResponse>(url, {
      method: 'PATCH',
      data: body,
      headers: { 'Content-Type': 'application/json' },
      params: params,
    }),
  httpStatus: HttpStatusCode,
};
