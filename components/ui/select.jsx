'use client';

import { Children, isValidElement } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Radix-uyumlu API (Select > SelectTrigger > SelectValue + SelectContent >
 * SelectItem) ile çağrılır ama altta tek bir stillendirilmiş native <select>
 * render eder. Seçili öğenin etiketi native olarak görünür; sıfır JS popup.
 */
export function Select({ value, onValueChange, children, className }) {
  const options = [];
  let placeholder = '';

  const walk = (nodes) => {
    Children.forEach(nodes, (child) => {
      if (!isValidElement(child)) return;
      if (child.type === SelectItem) {
        options.push({ value: child.props.value, label: child.props.children });
      } else if (child.type === SelectValue) {
        placeholder = child.props.placeholder || '';
      }
      if (child.props && child.props.children) {
        walk(child.props.children);
      }
    });
  };
  walk(children);

  return (
    <div className={cn('relative', className)}>
      <select
        value={value ?? ''}
        onChange={(e) => onValueChange?.(e.target.value)}
        className="h-9 w-full cursor-pointer appearance-none rounded-lg border border-input bg-background ps-3 pe-8 text-sm text-foreground outline-none hover:bg-accent focus:ring-2 focus:ring-ring/30"
      >
        {placeholder && (
          <option value="" disabled hidden>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {typeof o.label === 'string' ? o.label : o.value}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute end-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

/* Aşağıdakiler yalnızca veri taşıyıcı / API uyumluluğu içindir */
export function SelectTrigger({ children }) {
  return children ?? null;
}

export function SelectValue() {
  return null;
}

export function SelectContent({ children }) {
  return children ?? null;
}

export function SelectItem() {
  return null;
}
