'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Loader2, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useGetGeneralCategoriesQuery,
  useSearchGeneralCategoriesMutation,
} from '@/redux/services';

/**
 * Ürün kategori seçici — ID yazar.
 *
 * NEDEN VAR: eski CMS alanı virgüllü serbest metindi ve `categories`'e düz
 * string yazıyordu. Backend bu alanı ID olarak çözüyor (enrichCategoriesWithDetails,
 * productsController.js:400 — ObjectId/UUID regex'i), dashboard da `[category.id]`
 * gönderiyor. Serbest metin sessizce çözümlenemeyen kategori üretiyordu.
 *
 * ESKİ VERİ: ID'ye çözülemeyen mevcut değerler ham haliyle ve "eski kayıt"
 * rozetiyle gösterilir — admin bozuk veriyi görüp düzeltebilsin diye gizlenmez.
 */

const UUID_RE = /^[0-9a-fA-F-]{36}$/;
const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

const isCategoryId = (value) => {
  const v = String(value || '').trim();
  return OBJECT_ID_RE.test(v) || UUID_RE.test(v);
};

const categoryId = (cat) => String(cat?._id ?? cat?.id ?? '');
const categoryLabel = (cat) => cat?.name || cat?.label || cat?.title || '';
/** `path` slug dizisi; son eleman kategorinin kendisi → üst kırılım için at. */
const categoryTrail = (cat) =>
  Array.isArray(cat?.path) && cat.path.length > 1
    ? cat.path.slice(0, -1).join(' › ')
    : '';

export function CategoryPicker({ value = [], onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  // Görülen her kategoriyi id→etiket olarak biriktiririz; seçili chip'ler
  // sonuç listesi değişse de adını korusun.
  const [labels, setLabels] = useState({});
  const debounceRef = useRef(null);

  useEffect(() => {
    debounceRef.current = setTimeout(() => setDebouncedTerm(term.trim()), 300);
    return () => clearTimeout(debounceRef.current);
  }, [term]);

  const { data: browseItems = [], isFetching: isBrowsing } =
    useGetGeneralCategoriesQuery({ limit: 60 }, { skip: !open || !!debouncedTerm });

  const [searchCategories, { data: searchItems = [], isLoading: isSearching }] =
    useSearchGeneralCategoriesMutation();

  useEffect(() => {
    if (!open || !debouncedTerm) return;
    searchCategories({ query: debouncedTerm, limit: 60 });
  }, [open, debouncedTerm, searchCategories]);

  const items = debouncedTerm ? searchItems : browseItems;
  const isLoading = debouncedTerm ? isSearching : isBrowsing;

  // Sonuçlardan etiket sözlüğünü besle.
  useEffect(() => {
    if (!items.length) return;
    setLabels((current) => {
      let changed = false;
      const next = { ...current };
      for (const cat of items) {
        const id = categoryId(cat);
        const label = categoryLabel(cat);
        if (id && label && next[id] !== label) {
          next[id] = label;
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [items]);

  const selected = useMemo(
    () => (Array.isArray(value) ? value.map(String) : []),
    [value],
  );

  const toggle = (cat) => {
    const id = categoryId(cat);
    if (!id) return;
    onChange(
      selected.includes(id)
        ? selected.filter((item) => item !== id)
        : [...selected, id],
    );
  };

  const remove = (id) => onChange(selected.filter((item) => item !== id));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {selected.length === 0 && (
          <span className="text-xs text-muted-foreground">
            Kategori seçilmedi.
          </span>
        )}
        {selected.map((id) => {
          const legacy = !isCategoryId(id);
          return (
            <Badge
              key={id}
              variant={legacy ? 'warning' : 'secondary'}
              className="gap-1"
              title={legacy ? 'Eski serbest-metin kayıt — ID değil' : id}
            >
              <span className="max-w-[220px] truncate">
                {labels[id] || id}
              </span>
              {legacy && <span className="text-[10px] uppercase">eski</span>}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remove(id)}
                  className="opacity-60 transition-opacity hover:opacity-100"
                  aria-label="Kategoriyi kaldır"
                >
                  <X className="size-3" />
                </button>
              )}
            </Badge>
          );
        })}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            className="w-full justify-start"
          >
            <Search className="size-4" />
            Kategori ara / seç
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(28rem,90vw)] p-0">
          <div className="border-b border-border p-2">
            <Input
              autoFocus
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Kategori adı yazın…"
            />
          </div>
          <ScrollArea className="max-h-72">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Yükleniyor…
              </div>
            ) : items.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                {debouncedTerm
                  ? 'Eşleşen kategori yok.'
                  : 'Kategori listesi boş.'}
              </p>
            ) : (
              <ul className="py-1">
                {items.map((cat) => {
                  const id = categoryId(cat);
                  const isSelected = selected.includes(id);
                  const trail = categoryTrail(cat);
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => toggle(cat)}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                          isSelected ? 'bg-primary/5 text-primary' : ''
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {categoryLabel(cat) || id}
                          </span>
                          {trail && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {trail}
                            </span>
                          )}
                        </span>
                        {isSelected ? (
                          <Badge variant="primary">Seçili</Badge>
                        ) : (
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}
