import { cn } from '@/lib/utils';

const variants = {
  default: 'bg-muted/50 border-border text-foreground',
  destructive:
    'bg-destructive/10 border-destructive/30 text-destructive dark:text-red-400',
  warning:
    'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400',
  info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-400',
};

export function Alert({ variant = 'default', className, children }) {
  return (
    <div
      role="alert"
      className={cn('rounded-lg border p-4', variants[variant], className)}
    >
      {children}
    </div>
  );
}

export function AlertTitle({ className, children }) {
  return (
    <p className={cn('mb-1 font-semibold leading-tight text-sm', className)}>
      {children}
    </p>
  );
}

export function AlertDescription({ className, children }) {
  return (
    <p className={cn('text-sm', className)}>{children}</p>
  );
}
