'use client';

import { useSession } from 'next-auth/react';
import { Bell, LogOut, Menu, Search, Settings, User } from 'lucide-react';
import { useLogout } from '@/lib/useLogout';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function CmsHeader({ onMenuClick }) {
  const { data: session } = useSession();
  const logout = useLogout();

  const name = session?.user?.name;
  const email = session?.user?.email;

  return (
    <TooltipProvider delayDuration={300}>
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/95 px-5 backdrop-blur supports-[backdrop-filter]:bg-background/80">

        {/* Mobile menu toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          aria-label="Menüyü aç"
          className="size-9 shrink-0 lg:hidden"
        >
          <Menu className="size-5 text-muted-foreground" />
        </Button>

        {/* Search */}
        <div className="relative hidden flex-1 max-w-xs sm:block">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Ara..."
            className="h-9 w-full rounded-lg border border-input bg-muted/40 ps-9 pe-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all focus:bg-background focus:ring-2 focus:ring-ring/30"
          />
        </div>

        {/* Right section */}
        <div className="flex items-center gap-1 ms-auto">

          {/* Notifications */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative size-9 text-muted-foreground hover:text-foreground"
              >
                <Bell className="size-[18px]" />
                <span className="absolute end-2 top-2 size-1.5 rounded-full bg-primary ring-2 ring-background" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Bildirimler</TooltipContent>
          </Tooltip>

          <span className="mx-1 h-6 w-px bg-border" />

          {/* User dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-2.5 rounded-lg py-1 pe-2 ps-1 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/30"
                aria-label="Kullanıcı menüsü"
              >
                <Avatar name={name || email} size="sm" />
                <span className="hidden max-w-[120px] truncate text-sm font-medium text-foreground md:block">
                  {name || email}
                </span>
                <svg className="size-4 text-muted-foreground" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" sideOffset={8} className="w-60">
              {/* User info header */}
              <div className="flex items-center gap-3 px-3 py-2.5">
                <Avatar name={name || email} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {name || 'Kullanıcı'}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{email}</p>
                </div>
              </div>

              <DropdownMenuSeparator />

              <DropdownMenuItem className="gap-2.5">
                <User className="size-4 text-muted-foreground" />
                Profil
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2.5">
                <Settings className="size-4 text-muted-foreground" />
                Ayarlar
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                className="gap-2.5 text-destructive focus:text-destructive focus:bg-destructive/10"
                onSelect={logout}
              >
                <LogOut className="size-4" />
                Çıkış Yap
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    </TooltipProvider>
  );
}
