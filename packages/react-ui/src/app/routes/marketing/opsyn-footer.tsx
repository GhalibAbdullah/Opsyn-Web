import { Link } from 'react-router-dom';

import { OpSynFullLogo } from '@/components/ui/opsyn-logo';

const footerLinks = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '/#features' },
      { label: 'Integrations', href: '/#integrations' },
      { label: 'Docs', href: '/docs' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'GitHub', href: '#' },
      { label: 'Community', href: '#' },
      { label: 'Changelog', href: '#' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms', href: '#' },
      { label: 'Privacy', href: '#' },
      { label: 'License', href: '#' },
    ],
  },
];

export function OpsynFooter() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 py-12 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="inline-block">
              <OpSynFullLogo className="h-8 w-auto text-foreground" />
            </Link>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-xs">
              Open-source workflow automation platform with collaboration &amp;
              analytics.
            </p>
          </div>

          {/* Link columns */}
          {footerLinks.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold text-foreground mb-3">
                {col.title}
              </h4>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="border-t py-6 text-center">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Opsyn. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
