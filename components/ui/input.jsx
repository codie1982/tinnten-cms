import { cn } from '@/lib/utils';

export function Input({ className, type = 'text', ...props }) {
  return (
    <input
      type={type}
      className={cn(
        'h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground',
        'outline-none transition-shadow focus:ring-2 focus:ring-ring/30 disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
