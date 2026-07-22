'use client';

import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ProductCoreFields } from './ProductCoreFields';

/**
 * Ürün / hizmet düzenleme dialog'u — `ProductCoreFields` etrafında ince sarmalayıcı.
 *
 * Gövde üretimi ve doğrulama çağıran sayfada kalır (productFormModel.js'teki
 * toPatchPayload / validateProductForm ile); bu bileşen yalnız kabuk.
 */
export function ProductFormDialog({
  open,
  onOpenChange,
  form,
  setField,
  product,
  onSubmit,
  pending = false,
  title = 'Ürün / Hizmet Düzenle',
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Kaydetme sürerken dialog kapanmasın — yarım kalan istek kullanıcıya
        // görünmez olurdu.
        if (!pending) onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-3xl">
        <form onSubmit={onSubmit} className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <DialogBody className="max-h-[65vh] overflow-y-auto pr-1">
            <ProductCoreFields
              form={form}
              setField={setField}
              mode="edit"
              product={product}
              disabled={pending}
            />
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Vazgeç
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Kaydet
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
