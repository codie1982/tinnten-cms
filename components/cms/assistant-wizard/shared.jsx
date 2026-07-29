'use client';

/** Asistan sihirbazının adım formlarında paylaşılan küçük yapı taşları. */

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export function Field({ label, hint, required, children, className }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <label className="text-xs font-medium text-foreground">
          {label}
          {required && <span className="ms-0.5 text-destructive">*</span>}
        </label>
      ) : null}
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Textarea({ rows = 4, className, ...props }) {
  return (
    <textarea
      rows={rows}
      className={cn(
        'w-full rounded-lg border border-input bg-background p-3 text-sm text-foreground',
        'outline-none transition-shadow focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function ToggleRow({ label, hint, checked, onChange, disabled, badge }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-foreground">{label}</p>
          {badge}
        </div>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={!!checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

/** Etiket/liste editörü — enter veya + ile ekler, çipten x ile siler. */
export function TagInput({ value = [], onChange, placeholder = 'Ekle…', disabled }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (!v || value.includes(v)) {
      setDraft('');
      return;
    }
    onChange([...value, v]);
    setDraft('');
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        <Input
          value={draft}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="outline" size="icon" className="size-9 shrink-0" onClick={add} disabled={disabled}>
          <Plus className="size-3.5" />
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((v) => (
            <Badge key={v} variant="muted" className="gap-1 pe-1">
              {v}
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== v))}
                disabled={disabled}
                className="rounded-full p-0.5 hover:bg-foreground/10"
                aria-label={`${v} kaldır`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

/** Renk seçici — boş değer "tema varsayılanı" anlamına gelir. */
export function ColorInput({ value = '', onChange, allowEmpty = true, disabled }) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        value={value || '#000000'}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="size-9 shrink-0 cursor-pointer rounded-lg border border-input bg-background p-1"
      />
      <Input
        value={value}
        disabled={disabled}
        placeholder={allowEmpty ? 'tema varsayılanı' : '#000000'}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono text-xs"
      />
      {allowEmpty && value ? (
        <Button type="button" variant="outline" size="icon" className="size-9 shrink-0" onClick={() => onChange('')} title="Temizle">
          <X className="size-3.5" />
        </Button>
      ) : null}
    </div>
  );
}

/** Segment seçici — az sayıda seçenek için Select yerine. */
export function SegmentPicker({ options, value, onChange, disabled, columns = 3 }) {
  return (
    <div className={cn('grid gap-1.5', columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3')}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              'rounded-lg border px-3 py-2 text-start transition-colors',
              active
                ? 'border-primary bg-primary/10'
                : 'border-border hover:bg-accent disabled:opacity-50',
            )}
          >
            <span className={cn('block text-sm font-medium', active ? 'text-primary' : 'text-foreground')}>
              {o.label}
            </span>
            {o.hint && <span className="mt-0.5 block text-xs text-muted-foreground">{o.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Sayı girişi — min/max sınırlarına kırpar, boşa düşmez. */
export function NumberInput({ value, onChange, min, max, step = 1, disabled, className }) {
  return (
    <Input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      className={className}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (!Number.isFinite(n)) return;
        let next = n;
        if (typeof min === 'number') next = Math.max(min, next);
        if (typeof max === 'number') next = Math.min(max, next);
        onChange(next);
      }}
    />
  );
}
