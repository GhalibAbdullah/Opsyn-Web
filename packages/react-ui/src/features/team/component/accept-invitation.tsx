import { useMutation, useQueryClient } from '@tanstack/react-query';
import { HttpStatusCode } from 'axios';
import { t } from 'i18next';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { LoadingSpinner } from '@/components/ui/spinner';
import { INTERNAL_ERROR_TOAST, toast } from '@/components/ui/use-toast';
import { authenticationSession } from '@/lib/authentication-session';

import { api } from '../../../lib/api';
import { userInvitationApi } from '../lib/user-invitation';

const AcceptInvitation = () => {
  const [isInvitationLinkValid, setIsInvitationLinkValid] = useState(true);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const switchToProjectWithRetry = async (projectId: string): Promise<boolean> => {
    const attempts = 8;
    const baseDelayMs = 300;

    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        await authenticationSession.switchToProject(projectId);
        return true;
      } catch (error) {
        const delayMs = baseDelayMs * Math.pow(1.5, attempt);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        if (attempt === attempts - 1) {
          console.warn('Failed to switch to project after retries', { error, projectId });
        }
      }
    }
    return false;
  };

  const { mutate, isPending } = useMutation({
    mutationFn: async (token: string) => {
      const email = searchParams.get('email');
      const projectId = searchParams.get('projectId');
      const { registered } = await userInvitationApi.accept(token, email || undefined, projectId || undefined);
      return registered;
    },
    onSuccess: async (registered) => {
      setIsInvitationLinkValid(true);
      if (!registered) {
        setTimeout(() => {
          const email = searchParams.get('email');
          navigate(`/sign-up?email=${email}`);
        }, 3000);
      } else {
        // Invalidate projects cache to ensure the new project appears in the list
        await queryClient.invalidateQueries({ queryKey: ['projects'] });
        await queryClient.invalidateQueries({ queryKey: ['projects-for-platforms'] });
        
        // If user is already registered, try to get project ID from the invitation
        // and redirect to the project, otherwise go to sign-in
        const projectId = searchParams.get('projectId');
        if (projectId) {
          // Invalidate the switch-to-project query to ensure the project switch works
          await queryClient.invalidateQueries({ queryKey: ['switch-to-project', projectId] });

          const switched = await switchToProjectWithRetry(projectId);
          navigate(`/projects/${projectId}/flows?fromInvitation=true${switched ? '' : '&pendingSwitch=true'}`);
        } else {
          navigate('/sign-in');
        }
      }
    },

    onError: (error) => {
      setIsInvitationLinkValid(false);
      console.error('Error accepting invitation:', error);
      if (api.isError(error)) {
        switch (error.response?.status) {
          case HttpStatusCode.InternalServerError: {
            console.log(error);
            toast(INTERNAL_ERROR_TOAST);
            break;
          }
          case HttpStatusCode.Unauthorized:
          case HttpStatusCode.BadRequest:
          case HttpStatusCode.NotFound: {
            // Token is invalid, expired, or invitation not found
            toast({
              title: t('Invalid invitation token'),
              description: t('The invitation link may have expired or already been used. Please request a new invitation.'),
              variant: 'destructive',
            });
            break;
          }
          default: {
            const errorMessage = (error.response?.data as { message?: string })?.message;
            toast({
              title: t('Error accepting invitation'),
              description: errorMessage || t('Please try again later'),
              variant: 'destructive',
            });
            break;
          }
        }
      }
    },
  });
  useEffect(() => {
    const invitationToken = searchParams.get('token');
    if (!invitationToken) {
      setIsInvitationLinkValid(false);
      return;
    }
    // URL decode the token in case it was encoded
    const decodedToken = decodeURIComponent(invitationToken);
    console.log('Token from URL:', { 
      raw: invitationToken.substring(0, 50) + '...', 
      decoded: decodedToken.substring(0, 50) + '...',
      length: decodedToken.length 
    });
    mutate(decodedToken);
  }, [mutate, searchParams]);

  return isPending ? (
    <div className="w-screen h-screen flex justify-center items-center">
      <LoadingSpinner isLarge={true}></LoadingSpinner>
    </div>
  ) : (
    <div className="container mx-auto mt-10 max-w-md">
      {isInvitationLinkValid ? (
        <>
          <p className="text-2xl font-bold text-center">
            {t('Team Invitation Accepted')}
          </p>
          <p className="mt-4 text-lg text-center text-gray-700">
            {t(
              'Thank you for accepting the invitation. We are redirecting you right now...',
            )}
          </p>
        </>
      ) : (
        <p className="mt-4 text-lg text-center text-red-500">
          {t('Invalid invitation token. Please try again.')}
        </p>
      )}
    </div>
  );
};
AcceptInvitation.displayName = 'AcceptInvitation';
export { AcceptInvitation };
