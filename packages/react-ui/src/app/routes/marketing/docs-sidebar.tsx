import { useState, useMemo } from 'react';
import { Search, Menu, ChevronRight } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet';

import { docsContent, type DocsSection } from './docs-content';

interface DocsSidebarProps {
  activeSlug: string;
  onNavigate: (slug: string) => void;
}

function SidebarContent({
  activeSlug,
  onNavigate,
  search,
  setSearch,
}: DocsSidebarProps & { search: string; setSearch: (v: string) => void }) {
  const filtered = useMemo(() => {
    if (!search) return docsContent;
    const q = search.toLowerCase();
    return docsContent
      .map((section) => ({
        ...section,
        pages: section.pages.filter((p) =>
          p.title.toLowerCase().includes(q),
        ),
      }))
      .filter((s) => s.pages.length > 0);
  }, [search]);

  return (
    <div className="flex h-full flex-col">
      {/* Search */}
      <div className="p-4 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search docs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {filtered.map((section) => (
          <SidebarSection
            key={section.title}
            section={section}
            activeSlug={activeSlug}
            onNavigate={onNavigate}
          />
        ))}

        {filtered.length === 0 && (
          <p className="px-3 py-6 text-sm text-muted-foreground text-center">
            No results
          </p>
        )}
      </nav>
    </div>
  );
}

function SidebarSection({
  section,
  activeSlug,
  onNavigate,
}: {
  section: DocsSection;
  activeSlug: string;
  onNavigate: (slug: string) => void;
}) {
  return (
    <div className="mb-4">
      <h4 className="mb-1 px-3 pt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {section.title}
      </h4>
      <ul className="space-y-0.5">
        {section.pages.map((page) => {
          const isActive = page.slug === activeSlug;
          return (
            <li key={page.slug}>
              <button
                onClick={() => onNavigate(page.slug)}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <ChevronRight
                  className={`size-3.5 shrink-0 transition-transform ${
                    isActive ? 'text-primary' : 'text-muted-foreground/50'
                  }`}
                />
                {page.title}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function DocsSidebar({ activeSlug, onNavigate }: DocsSidebarProps) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const handleNavigate = (slug: string) => {
    onNavigate(slug);
    setOpen(false);
  };

  return (
    <>
      {/* Mobile trigger */}
      <div className="flex items-center border-b px-4 py-2 lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <Menu className="size-4" />
              Docs menu
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetClose className="sr-only">Close</SheetClose>
            <SidebarContent
              activeSlug={activeSlug}
              onNavigate={handleNavigate}
              search={search}
              setSearch={setSearch}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col border-r bg-muted/20">
        <SidebarContent
          activeSlug={activeSlug}
          onNavigate={onNavigate}
          search={search}
          setSearch={setSearch}
        />
      </aside>
    </>
  );
}
