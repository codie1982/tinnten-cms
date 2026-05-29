'use client';

import { createContext, useContext } from 'react';
import { cn } from '@/lib/utils';

const TabsCtx = createContext({ value: '', onValueChange: () => {} });

export function Tabs({ value, onValueChange, defaultValue, className, children }) {
  return (
    <TabsCtx.Provider value={{ value: value ?? defaultValue ?? '', onValueChange }}>
      <div className={className}>{children}</div>
    </TabsCtx.Provider>
  );
}

export function TabsList({ className, children }) {
  return (
    <div
      className={cn(
        'flex overflow-x-auto border-b border-border gap-0',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children, className }) {
  const { value: active, onValueChange } = useContext(TabsCtx);
  const isActive = active === value;
  return (
    <button
      type="button"
      onClick={() => onValueChange?.(value)}
      className={cn(
        '-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
        isActive
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children, className }) {
  const { value: active } = useContext(TabsCtx);
  if (active !== value) return null;
  return <div className={className}>{children}</div>;
}
