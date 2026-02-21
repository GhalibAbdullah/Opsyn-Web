import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

import { OpSynFullLogo } from '@/components/ui/opsyn-logo';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet';

const navLinks = [
  { label: 'Docs', href: '/docs' },
  { label: 'Features', href: '/#features' },
  { label: 'Integrations', href: '/#integrations' },
];

export function OpsynNavbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <OpSynFullLogo className="h-8 w-auto text-foreground" />
        </Link>

        {/* Desktop nav links */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground rounded-md hover:bg-accent"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Desktop auth buttons */}
        <div className="hidden md:flex items-center gap-6">
          <Button
            variant="ghost"
            className="transition-all duration-200 hover:text-primary hover:bg-primary/5 hover:scale-105 active:scale-95"
            asChild
          >
            <Link to="/sign-in">Log in</Link>
          </Button>
          <Button
            className="transition-all duration-200 hover:bg-primary/95 hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-primary/25"
            asChild
          >
            <Link to="/sign-up">Sign up</Link>
          </Button>
        </div>

        {/* Mobile menu */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72 p-0">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <OpSynFullLogo className="h-7 w-auto text-foreground" />
              <SheetClose asChild>
                <Button variant="ghost" size="icon" aria-label="Close menu">
                  <X className="size-5" />
                </Button>
              </SheetClose>
            </div>
            <nav className="flex flex-col gap-1 p-4">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent"
                >
                  {link.label}
                </a>
              ))}
              <div className="my-3 border-t" />
              <Button variant="outline" asChild className="w-full">
                <Link to="/sign-in" onClick={() => setOpen(false)}>
                  Log in
                </Link>
              </Button>
              <Button asChild className="w-full mt-2">
                <Link to="/sign-up" onClick={() => setOpen(false)}>
                  Sign up
                </Link>
              </Button>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
