import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, ArrowRight } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface Integration {
  name: string;
  category: string;
  color: string;
}

const integrations: Integration[] = [
  { name: 'Slack', category: 'Communication', color: '#E01E5A' },
  { name: 'Discord', category: 'Communication', color: '#5865F2' },
  { name: 'Telegram', category: 'Communication', color: '#26A5E4' },
  { name: 'Microsoft Teams', category: 'Communication', color: '#6264A7' },
  { name: 'Gmail', category: 'Email', color: '#EA4335' },
  { name: 'Outlook', category: 'Email', color: '#0078D4' },
  { name: 'Google Sheets', category: 'Google Workspace', color: '#34A853' },
  { name: 'Google Drive', category: 'Google Workspace', color: '#4285F4' },
  { name: 'Google Docs', category: 'Google Workspace', color: '#4285F4' },
  { name: 'OpenAI', category: 'AI & Automation', color: '#412991' },
  { name: 'Anthropic', category: 'AI & Automation', color: '#754ABC' },
  { name: 'Notion', category: 'Productivity', color: '#000000' },
  { name: 'Airtable', category: 'Productivity', color: '#18BFFF' },
  { name: 'Trello', category: 'Project Mgmt', color: '#0079BF' },
  { name: 'Asana', category: 'Project Mgmt', color: '#F06A6A' },
  { name: 'ClickUp', category: 'Project Mgmt', color: '#7B68EE' },
  { name: 'Monday', category: 'Project Mgmt', color: '#FF3D57' },
  { name: 'GitHub', category: 'Developer Tools', color: '#333333' },
  { name: 'GitLab', category: 'Developer Tools', color: '#FC6D26' },
  { name: 'Jira', category: 'Developer Tools', color: '#0052CC' },
  { name: 'Stripe', category: 'Payments', color: '#635BFF' },
  { name: 'Shopify', category: 'E-Commerce', color: '#96BF48' },
  { name: 'HubSpot', category: 'CRM & Marketing', color: '#FF7A59' },
  { name: 'Salesforce', category: 'CRM & Marketing', color: '#00A1E0' },
  { name: 'Mailchimp', category: 'CRM & Marketing', color: '#FFE01B' },
  { name: 'Zendesk', category: 'Customer Support', color: '#03363D' },
  { name: 'Intercom', category: 'Customer Support', color: '#2860FF' },
  { name: 'PostgreSQL', category: 'Databases', color: '#336791' },
  { name: 'MySQL', category: 'Databases', color: '#4479A1' },
  { name: 'Supabase', category: 'Databases', color: '#3ECF8E' },
];

function IntegrationBadge({
  name,
  color,
}: {
  name: string;
  color: string;
}) {
  return (
    <div
      className="flex size-10 items-center justify-center rounded-lg text-white text-sm font-bold shrink-0"
      style={{ backgroundColor: color }}
    >
      {name.charAt(0)}
    </div>
  );
}

export function IntegrationsGrid() {
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () =>
      integrations.filter((i) =>
        i.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [search],
  );

  return (
    <section id="integrations" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Integrations
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Connect Opsyn to the tools you already use.
          </p>
        </div>

        {/* Search */}
        <div className="mx-auto mt-10 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search integrations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Grid */}
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((integration) => (
            <Card
              key={integration.name}
              className="flex items-center gap-3 p-4 transition-all duration-200 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5"
            >
              <IntegrationBadge
                name={integration.name}
                color={integration.color}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {integration.name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {integration.category}
                </p>
              </div>
            </Card>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            No integrations match &ldquo;{search}&rdquo;
          </p>
        )}

        {/* CTA */}
        <div className="mt-10 text-center">
          <Button variant="outline" asChild>
            <Link
              to="/docs?page=integrations-overview"
              className="inline-flex items-center gap-2 whitespace-nowrap"
            >
              View all integrations
              <ArrowRight className="size-4 shrink-0" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
