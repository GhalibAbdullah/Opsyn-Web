import type { LucideIcon } from 'lucide-react';

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';

interface LandingFeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function LandingFeatureCard({
  icon: Icon,
  title,
  description,
}: LandingFeatureCardProps) {
  return (
    <Card className="group relative overflow-hidden border-border/60 bg-background transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <CardHeader className="relative">
        <div className="mb-3 flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
          <Icon className="size-5" />
        </div>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="text-sm leading-relaxed">
          {description}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
