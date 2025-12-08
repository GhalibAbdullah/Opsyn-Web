import { useQuery, useQueryClient } from '@tanstack/react-query';
import { t } from 'i18next';
import { Plus, Settings, Key, Users, LayoutGrid } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { projectApi } from '@/lib/project-api';
import { authenticationSession } from '@/lib/authentication-session';
import { AccountSettingsDialog } from '@/app/components/account-settings';
import { cn } from '@/lib/utils';

import { NewProjectDialog } from '../platform/projects/new-project-dialog';

export default function DashboardPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [navigatingProjectId, setNavigatingProjectId] = useState<string | null>(
    null,
  );

  // Debug: Log when component mounts/renders
  useEffect(() => {
    console.log('📊 Dashboard mounted/rendered');
    return () => {
      console.log('📊 Dashboard unmounting');
    };
  }, []);

  const { data: projectsData, isLoading, refetch } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectApi.list({ limit: 10 }),
  });

  const handleProjectCreated = async (project?: any) => {
    // Refetch projects list
    await refetch();
    
    // If a project was created, navigate to it with retry flag
    // The route wrapper will handle switching and retry logic
    // We navigate immediately - the route wrapper's guard will show loading
    // and retry logic will handle any timing issues with project accessibility
    if (project) {
      // Navigate with fromNewProject flag to trigger retry logic in route wrapper
      // This ensures we show a loading screen and retry if validation fails
      // The route wrapper will switch to the project and retry if needed
      navigate(`/projects/${project.id}/flows?fromNewProject=true`);
    }
  };

  // Deduplicate projects by ID (in case of any cache or backend issues)
  const projects = useMemo(() => {
    const projectsArray = projectsData?.data || [];
    const uniqueProjects = new Map<string, typeof projectsArray[0]>();
    projectsArray.forEach((project) => {
      if (!uniqueProjects.has(project.id)) {
        uniqueProjects.set(project.id, project);
      }
    });
    return Array.from(uniqueProjects.values());
  }, [projectsData?.data]);
  const hasProjects = projects.length > 0;
  const isNavigatingProject = Boolean(navigatingProjectId);

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header with User Profile */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">{t('Welcome')}</h1>
          <p className="text-muted-foreground">
            {hasProjects
              ? t('Manage your projects and create new ones')
              : t('Get started by creating your first project')}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setAccountSettingsOpen(true)}
        >
          <Settings className="h-4 w-4 mr-2" />
          {t('Account Settings')}
        </Button>
      </div>

      {/* Settings Quick Access */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">{t('Settings')}</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Link to="/platform">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow h-full border-2 border-primary">
              <CardHeader>
                <Settings className="h-8 w-8 mb-2 text-primary" />
                <CardTitle className="text-base">{t('Platform Admin')}</CardTitle>
                <CardDescription className="text-sm">
                  {t('Access all platform settings')}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
          <Link to="/platform/projects">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow h-full">
              <CardHeader>
                <LayoutGrid className="h-8 w-8 mb-2 text-primary" />
                <CardTitle className="text-base">{t('Projects')}</CardTitle>
                <CardDescription className="text-sm">
                  {t('Manage your projects')}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
          <Link to="/platform/security/api-keys">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow h-full">
              <CardHeader>
                <Key className="h-8 w-8 mb-2 text-primary" />
                <CardTitle className="text-base">{t('API Keys')}</CardTitle>
                <CardDescription className="text-sm">
                  {t('Manage API keys')}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">{t('Loading...')}</p>
        </div>
      ) : hasProjects ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">{t('Your Projects')}</h2>
            <NewProjectDialog
              onCreate={handleProjectCreated}
            >
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                {t('New Project')}
              </Button>
            </NewProjectDialog>
          </div>
          <div
            className={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-3', {
              'pointer-events-none opacity-60': isNavigatingProject,
            })}
          >
            {projects.map((project) => (
              <Card
                key={project.id}
                className={cn(
                  'cursor-pointer hover:shadow-lg transition-shadow',
                  {
                    'cursor-wait':
                      navigatingProjectId &&
                      navigatingProjectId === project.id,
                  },
                )}
                onClick={async () => {
                  if (isNavigatingProject) {
                    return;
                  }
                  const targetUrl = `/projects/${project.id}/flows`;
                  setNavigatingProjectId(project.id);

                  // Navigate immediately so the URL reflects the chosen project
                  navigate(targetUrl);

                  try {
                    await authenticationSession.switchToProject(project.id);
                    // Ensure we land on the target page once the session is switched
                    navigate(targetUrl, { replace: true });
                  } catch (error) {
                    toast({
                      title: t('Error'),
                      description: t('Failed to switch project'),
                      variant: 'destructive',
                    });
                    // Return user to dashboard if switching failed
                    navigate('/dashboard', { replace: true });
                  } finally {
                    setNavigatingProjectId(null);
                  }
                }}
              >
                <CardHeader>
                  <CardTitle>{project.displayName}</CardTitle>
                  <CardDescription>
                    {t('Created')} {new Date(project.created).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full">
                    {t('Open Project')}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <Card className="text-center py-12">
          <CardHeader>
            <CardTitle className="text-2xl mb-2">{t('No Projects Yet')}</CardTitle>
            <CardDescription className="text-base">
              {t('Create your first project to start building workflows')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NewProjectDialog
              onCreate={handleProjectCreated}
            >
              <Button size="lg">
                <Plus className="h-4 w-4 mr-2" />
                {t('Create Your First Project')}
              </Button>
            </NewProjectDialog>
          </CardContent>
        </Card>
      )}

      <AccountSettingsDialog
        open={accountSettingsOpen}
        onClose={() => setAccountSettingsOpen(false)}
      />
    </div>
  );
}

