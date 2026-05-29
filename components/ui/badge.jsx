import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        primary: 'bg-primary/10 text-primary',
        success:
          'bg-green-500/10 text-green-600 dark:text-green-400',
        warning:
          'bg-amber-500/10 text-amber-600 dark:text-amber-400',
        destructive: 'bg-destructive/10 text-destructive',
        secondary: 'bg-secondary text-secondary-foreground',
        muted: 'bg-muted text-muted-foreground',
        outline: 'border border-border text-foreground',
      },
    },
    defaultVariants: { variant: 'secondary' },
  },
);

export function Badge({ className, variant, dot, children, ...props }) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span className="size-1.5 rounded-full bg-current opacity-90" />
      )}
      {children}
    </span>
  );
}

export { badgeVariants };
