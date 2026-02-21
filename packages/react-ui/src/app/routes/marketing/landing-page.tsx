import { Link } from 'react-router-dom';
import {
  Workflow,
  Puzzle,
  Webhook,
  Users,
  BarChart3,
  ShieldCheck,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

import { Button } from '@/components/ui/button';

import { OpsynNavbar } from './opsyn-navbar';
import { OpsynFooter } from './opsyn-footer';
import { LandingFeatureCard } from './landing-feature-card';
import { IntegrationsGrid } from './integrations-grid';

const features = [
  {
    icon: Workflow,
    title: 'Workflow Builder',
    description:
      'Design complex automation flows visually with a drag-and-drop canvas. No code required.',
  },
  {
    icon: Puzzle,
    title: 'Integrations (Pieces)',
    description:
      'Connect to hundreds of apps and services through a growing library of pre-built pieces.',
  },
  {
    icon: Webhook,
    title: 'Webhooks & Scheduling',
    description:
      'Trigger flows via webhooks, cron schedules, or events from connected services.',
  },
  {
    icon: Users,
    title: 'Team Collaboration',
    description:
      'Invite team members, manage roles, and collaborate on flows together in real time.',
  },
  {
    icon: BarChart3,
    title: 'Flow Analytics',
    description:
      'Monitor execution history, success rates, and performance metrics for every flow.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure Execution',
    description:
      'Isolated worker processes, encrypted secrets, and audit logs keep your data safe.',
  },
];

export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <OpsynNavbar />

      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden">
        {/* Gradient orbs */}
        <div className="pointer-events-none absolute -top-40 left-1/2 size-[600px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-20 right-0 size-[400px] rounded-full bg-primary/5 blur-[100px]" />

        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-36 lg:px-8 lg:py-44 text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary mb-8">
            <Sparkles className="size-3.5" />
            Open-source workflow automation
          </div>

          <h1 className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            Automate workflows.{' '}
            <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Ship faster.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed sm:text-xl">
            Opsyn is a workflow automation platform with built-in team
            collaboration and flow analytics.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button
              size="lg"
              className="transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-xl hover:shadow-primary/20"
              asChild
            >
              <Link
                to="/sign-up"
                className="flex items-center justify-center gap-2 px-8"
              >
                <span className="whitespace-nowrap">Get started</span>
                <ArrowRight className="size-4 shrink-0" />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="transition-all duration-200 hover:scale-105 active:scale-95"
              asChild
            >
              <Link to="/docs" className="flex items-center justify-center px-8">
                Read docs
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="py-20 sm:py-28 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need to automate
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Powerful building blocks for any automation workflow.
            </p>
          </div>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <LandingFeatureCard key={f.title} {...f} />
            ))}
          </div>
        </div>
      </section>

      {/* ─── Integrations ─── */}
      <IntegrationsGrid />

      <OpsynFooter />
    </div>
  );
}
