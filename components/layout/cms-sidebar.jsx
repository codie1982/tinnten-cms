'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { canAccess } from '@/lib/roles';
import { CMS_NAV } from '@/config/cms-nav';
import {
  AccordionMenu,
  AccordionMenuGroup,
  AccordionMenuItem,
  AccordionMenuLabel,
  AccordionMenuSub,
  AccordionMenuSubContent,
  AccordionMenuSubTrigger,
} from '@/components/ui/accordion-menu';
import { Badge } from '@/components/ui/badge';

/* ─── Nav filtering ─── */
function filterNav(roles) {
  const visible = [];
  for (const item of CMS_NAV) {
    if (item.heading) { visible.push(item); continue; }
    if (item.children) {
      const children = item.children.filter((c) => canAccess(roles, c.roles));
      if (children.length > 0) visible.push({ ...item, children });
    } else if (canAccess(roles, item.roles)) {
      visible.push(item);
    }
  }
  return visible.filter((item, i) => {
    if (!item.heading) return true;
    const next = visible[i + 1];
    return next && !next.heading;
  });
}

/* ─── Sidebar Menu (AccordionMenu tabanlı) ─── */
function SidebarMenu({ pathname }) {
  const { data: session, status } = useSession();
  const roles = session?.roles ?? [];
  const items = filterNav(roles);

  const matchPath = useCallback(
    (path) => path === pathname || (path.length > 1 && pathname.startsWith(path + '/')),
    [pathname],
  );

  const classNames = {
    root: 'space-y-0.5',
    group: 'gap-px',
    label: 'uppercase text-[11px] font-semibold tracking-wider text-muted-foreground/50 pt-5 pb-1 px-3 first:pt-1',
    item: [
      'h-9 rounded-lg px-3 text-sm font-medium',
      'text-foreground/70 hover:bg-accent hover:text-foreground',
      'data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary',
    ].join(' '),
    subTrigger: [
      'h-9 rounded-lg px-3 text-sm font-medium',
      'text-foreground/70 hover:bg-accent hover:text-foreground',
      'data-[selected=true]:text-foreground',
    ].join(' '),
    subContent: 'ps-4 py-0.5',
  };

  if (status === 'loading') return <NavSkeleton />;
  if (items.length === 0) return <EmptyNavNotice hasSession={!!session} />;

  const buildItems = (navItems) =>
    navItems.map((item, i) => {
      /* Heading */
      if (item.heading) {
        return <AccordionMenuLabel key={`h-${i}`}>{item.heading}</AccordionMenuLabel>;
      }
      /* Disabled / coming-soon item (tıklanamaz, "Yakında" rozetli) */
      if (item.disabled) {
        const Icon = item.icon;
        return (
          <div
            key={item.title}
            className="flex h-9 cursor-not-allowed items-center gap-2.5 rounded-lg px-3 text-sm font-medium text-foreground/40 select-none"
            aria-disabled="true"
            title="Bu modül yakında aktif olacak"
          >
            {Icon && <Icon className="size-[18px] shrink-0 opacity-50" />}
            <span className="flex-1">{item.title}</span>
            {item.comingSoon && (
              <Badge variant="warning" className="text-[10px]">Yakında</Badge>
            )}
          </div>
        );
      }

      /* Parent with children */
      if (item.children) {
        const Icon = item.icon;
        return (
          <AccordionMenuSub key={item.title} value={item.title}>
            <AccordionMenuSubTrigger className="text-sm font-medium">
              {Icon && <Icon className="size-[18px] shrink-0 opacity-70" />}
              <span>{item.title}</span>
            </AccordionMenuSubTrigger>
            <AccordionMenuSubContent
              type="single"
              collapsible
              parentValue={item.title}
              className="ps-5 border-s border-border/50 ms-[18px]"
            >
              <AccordionMenuGroup>
                {item.children.map((child) => (
                  <AccordionMenuItem
                    key={child.path}
                    value={child.path}
                    className="h-8 rounded-lg ps-3 text-[13px] font-medium text-foreground/60 hover:bg-transparent hover:text-primary data-[selected=true]:text-primary data-[selected=true]:font-semibold"
                  >
                    <Link href={child.path} className="flex w-full items-center">
                      {child.title}
                    </Link>
                  </AccordionMenuItem>
                ))}
              </AccordionMenuGroup>
            </AccordionMenuSubContent>
          </AccordionMenuSub>
        );
      }
      /* Leaf item */
      const Icon = item.icon;
      return (
        <AccordionMenuItem key={item.path} value={item.path} className="text-sm font-medium">
          <Link href={item.path} className="flex w-full items-center gap-2.5">
            {Icon && <Icon className="size-[18px] shrink-0 opacity-70" />}
            {item.title}
          </Link>
        </AccordionMenuItem>
      );
    });

  return (
    <AccordionMenu
      selectedValue={pathname}
      matchPath={matchPath}
      type="single"
      collapsible
      classNames={classNames}
    >
      {buildItems(items)}
    </AccordionMenu>
  );
}

/* ─── Sidebar ─── */
export function CmsSidebar({ mobileOpen = false, onClose }) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Menüyü kapat"
          className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          /* sizing */
          'fixed inset-y-0 start-0 z-50 flex w-[280px] shrink-0 flex-col',
          /* style */
          'border-e border-border bg-card',
          /* transition */
          'transition-transform duration-200',
          /* lg: always visible, mobile: controlled */
          'lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Logo header */}
        <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-border px-5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            t
          </span>
          <span className="text-[15px] font-bold tracking-tight text-foreground">
            tinnten <span className="text-primary">CMS</span>
          </span>
          {/* Mobile close */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Menüyü kapat"
            className="ms-auto flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Scrollable nav */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
          <SidebarMenu pathname={pathname} />
        </nav>

        {/* Footer */}
        <div className="shrink-0 border-t border-border px-5 py-3">
          <p className="text-[11px] text-muted-foreground">tinnten CMS · v1.0</p>
        </div>
      </aside>
    </>
  );
}

/* ─── Skeletons ─── */
function NavSkeleton() {
  return (
    <div className="space-y-1.5 px-1">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-9 animate-pulse rounded-lg bg-muted/60" style={{ width: `${70 + ((i * 13) % 25)}%` }} />
      ))}
    </div>
  );
}

function EmptyNavNotice({ hasSession }) {
  return (
    <div className="mx-1 mt-4 rounded-lg border border-dashed border-border bg-muted/40 p-3 text-center">
      <p className="text-xs font-medium text-foreground">
        {hasSession ? 'Erişiminiz kısıtlı' : 'Oturum bilgisi alınamadı'}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {hasSession ? 'Bu hesap için tanımlı CMS rolü bulunamadı.' : 'Lütfen tekrar giriş yapın.'}
      </p>
    </div>
  );
}
