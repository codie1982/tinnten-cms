'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Edit3, Loader2, MapPin, Save } from 'lucide-react';
import { useUpdateCmsProductLocationMutation } from '@/redux/services';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardToolbar,
} from '@/components/ui/card';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { locationModeMeta, locationModeOptions } from '../../_data';

const LeafletMapPicker = dynamic(
  () => import('@/components/maps/LeafletMapPicker'),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 w-full animate-pulse rounded-lg bg-muted" />
    ),
  },
);

function mutationMessage(error, fallback) {
  return (
    error?.data?.message ||
    error?.normalizedMessage ||
    error?.message ||
    fallback
  );
}

function toNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function buildForm(product) {
  const loc = product?.location || {};
  const coords = loc.coordinates || {};
  return {
    mode: loc.mode || 'fixed',
    province: loc.province || '',
    district: loc.district || '',
    address: loc.address || '',
    radiusKm: loc.radiusKm != null ? String(loc.radiusKm) : '',
    lat: toNum(coords.lat),
    lng: toNum(coords.lng),
  };
}

export default function LocationSection({ product, onNotice }) {
  const id = product?._id || product?.id;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => buildForm(product));
  const [updateLocation, { isLoading }] = useUpdateCmsProductLocationMutation();

  useEffect(() => {
    if (product) setForm(buildForm(product));
  }, [product]);

  const set = (field, value) =>
    setForm((cur) => ({ ...cur, [field]: value }));

  const loc = product?.location || {};
  const modeMeta = locationModeMeta[loc.mode] || locationModeMeta.fixed;
  const showRadius = form.mode === 'radius';

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = {
      id,
      mode: form.mode,
      province: form.province.trim(),
      district: form.district.trim(),
      address: form.address.trim(),
    };
    if (form.mode === 'radius') {
      payload.radiusKm = toNum(form.radiusKm) ?? 0;
    }
    if (form.lat != null && form.lng != null) {
      payload.coordinates = { lat: form.lat, lng: form.lng };
    }

    try {
      await updateLocation(payload).unwrap();
      setOpen(false);
      onNotice?.({
        variant: 'info',
        title: 'Konum güncellendi',
        description: 'Değişiklikler kaydedildi.',
      });
    } catch (err) {
      onNotice?.({
        variant: 'destructive',
        title: 'Güncelleme başarısız',
        description: mutationMessage(err, 'Konum güncellenirken hata oluştu.'),
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Konum</CardTitle>
        <CardToolbar>
          <Badge variant={modeMeta.variant}>{modeMeta.label}</Badge>
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <Edit3 className="size-4" />
            Düzenle
          </Button>
        </CardToolbar>
      </CardHeader>
      <CardContent className="grid gap-x-8 gap-y-1 p-6 sm:grid-cols-2">
        <div className="flex items-start gap-3 py-2">
          <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Adres</p>
            <p className="text-sm font-medium text-foreground break-words">
              {loc.address || '—'}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 py-2">
          <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">İl / İlçe</p>
            <p className="text-sm font-medium text-foreground">
              {[loc.province, loc.district].filter(Boolean).join(' / ') || '—'}
            </p>
          </div>
        </div>
        {loc.mode === 'radius' && (
          <div className="flex items-start gap-3 py-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Hizmet Yarıçapı</p>
              <p className="text-sm font-medium text-foreground">
                {loc.radiusKm ? `${loc.radiusKm} km` : '—'}
              </p>
            </div>
          </div>
        )}
        {loc.coordinates?.lat != null && loc.coordinates?.lng != null && (
          <div className="flex items-start gap-3 py-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Koordinat</p>
              <p className="font-mono text-sm font-medium text-foreground">
                {loc.coordinates.lat.toFixed(5)}, {loc.coordinates.lng.toFixed(5)}
              </p>
            </div>
          </div>
        )}
      </CardContent>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!isLoading) setOpen(next);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl">
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
            <DialogHeader>
              <DialogTitle>Konum Düzenle</DialogTitle>
            </DialogHeader>
            <DialogBody className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Konum Modu
                </span>
                <Select
                  value={form.mode}
                  onValueChange={(value) => set('mode', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Mod" />
                  </SelectTrigger>
                  <SelectContent>
                    {locationModeOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              {form.mode !== 'online' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      İl
                    </span>
                    <Input
                      value={form.province}
                      onChange={(e) => set('province', e.target.value)}
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      İlçe
                    </span>
                    <Input
                      value={form.district}
                      onChange={(e) => set('district', e.target.value)}
                    />
                  </label>
                  <label className="space-y-1.5 sm:col-span-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Adres
                    </span>
                    <Input
                      value={form.address}
                      onChange={(e) => set('address', e.target.value)}
                    />
                  </label>
                  {showRadius && (
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium text-muted-foreground">
                        Hizmet Yarıçapı (km)
                      </span>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={form.radiusKm}
                        onChange={(e) => set('radiusKm', e.target.value)}
                      />
                    </label>
                  )}
                </div>
              )}

              {form.mode !== 'online' && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Harita üzerinde tıklayarak konumu belirleyin
                  </p>
                  <LeafletMapPicker
                    lat={form.lat}
                    lng={form.lng}
                    radiusKm={toNum(form.radiusKm) ?? 0}
                    showRadius={showRadius}
                    onChange={({ lat, lng }) => {
                      set('lat', lat);
                      set('lng', lng);
                    }}
                  />
                  {form.lat != null && form.lng != null && (
                    <p className="font-mono text-xs text-muted-foreground">
                      {form.lat.toFixed(5)}, {form.lng.toFixed(5)}
                    </p>
                  )}
                </div>
              )}
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isLoading}
              >
                Vazgeç
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
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
    </Card>
  );
}
