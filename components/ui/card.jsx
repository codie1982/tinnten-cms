import { cn } from '@/lib/utils';

export function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card text-card-foreground shadow-sm shadow-black/[0.03]',
        className,
      )}
      {...props}
    />
  );
}

// Başlık + sağda toolbar; içerikten ince bir çizgiyle ayrılır.
export function CardHeader({ className, ...props }) {
  return (
    <div
      className={cn(
        'flex min-h-14 items-center justify-between gap-4 border-b border-border px-5 py-3',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeading({ className, ...props }) {
  return <div className={cn('flex flex-col gap-0.5', className)} {...props} />;
}

export function CardTitle({ className, ...props }) {
  return (
    <h3
      className={cn('text-[15px] font-semibold tracking-tight', className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }) {
  return (
    <p className={cn('text-sm text-muted-foreground', className)} {...props} />
  );
}

export function CardToolbar({ className, ...props }) {
  return (
    <div className={cn('flex items-center gap-2', className)} {...props} />
  );
}

export function CardContent({ className, ...props }) {
  return <div className={cn('p-5', className)} {...props} />;
}

export function CardFooter({ className, ...props }) {
  return (
    <div
      className={cn(
        'flex items-center border-t border-border px-5 py-4',
        className,
      )}
      {...props}
    />
  );
}
