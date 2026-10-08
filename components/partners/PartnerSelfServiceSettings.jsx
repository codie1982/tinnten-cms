'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useGetCmsPartnerListingQuery, useSaveCmsPartnerListingMutation } from '@/redux/services/companyPartnersApi';

export default function PartnerSelfServiceSettings({ companyId }) {
  const { data, isLoading, error } = useGetCmsPartnerListingQuery(companyId);
  const [save, { isLoading: saving }] = useSaveCmsPartnerListingMutation();
  const [form, setForm] = useState(null);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (data) setForm({ description: '', logoUrl: '', published: false, representativeIds: [], ...data.defaults, ...(data.listing || {}) });
  }, [data]);
  const set = (key, value) => { setNotice(''); setForm((current) => ({ ...current, [key]: value })); };
  if (isLoading) return <p className="text-sm text-muted-foreground">Partner katalog ayarları yükleniyor…</p>;
  if (error) return <p role="alert" className="text-sm text-destructive">Katalog ayarları yüklenemedi.</p>;
  if (!form) return null;
  return <section className="space-y-4 rounded-lg border border-border bg-card p-4">
    <div><h3 className="font-semibold">Kullanıcıların ekleyebileceği ücretsiz partner</h3><p className="mt-1 text-sm text-muted-foreground">Yayınlandığında firma partner kataloğunda görünür. Kullanıcı onayıyla hesap yönetimi açılır; temsilciler ekip kontenjanından düşmez.</p></div>
    {!data.eligible && <p className="text-sm text-destructive">Kataloğu yayınlamadan önce firmayı partner olarak onaylayın.</p>}
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.published} disabled={saving || !data.eligible} onChange={(event) => set('published', event.target.checked)} />Katalogda yayınla</label>
    <label className="block space-y-1 text-sm"><span>Hizmet açıklaması</span><textarea rows={3} className="w-full rounded-md border border-input bg-background p-3" maxLength={1000} value={form.description} onChange={(event) => set('description', event.target.value)} disabled={saving} /></label>
    <label className="block space-y-1 text-sm"><span>Logo adresi (HTTPS)</span><Input value={form.logoUrl} onChange={(event) => set('logoUrl', event.target.value)} disabled={saving} /></label>
    <fieldset className="space-y-2"><legend className="mb-2 text-sm font-medium">Yetkilendirilecek firma temsilcileri</legend>
      {data.representatives.map((member) => <label key={member.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.representativeIds.includes(member.id)} disabled={saving} onChange={(event) => set('representativeIds', event.target.checked ? [...form.representativeIds, member.id] : form.representativeIds.filter((id) => id !== member.id))} />{member.name || member.email} · {member.email}</label>)}
    </fieldset>
    <div className="rounded-md bg-muted p-3 text-sm">Bu hizmet ücretsizdir. Ekip kontenjanından düşmez. Gelir ortaklığı bu ayardan bağımsız yönetilir.</div>
    <label className="block space-y-1 text-sm"><span>Onay metni sürümü</span><Input value={form.consentVersion} maxLength={80} disabled={saving} onChange={(event) => set('consentVersion', event.target.value)} /></label>
    <label className="block space-y-1 text-sm"><span>Kullanıcıya gösterilecek onay metni</span><textarea rows={5} className="w-full rounded-md border border-input bg-background p-3" value={form.consentText} maxLength={10000} disabled={saving} onChange={(event) => set('consentText', event.target.value)} /></label>
    <details className="text-sm"><summary className="cursor-pointer">Yetki şablonu · {form.templateVersion} ({form.permissions.length})</summary><div className="mt-3 grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">{data.defaults.permissions.map((permission) => <label key={permission} className="flex items-center gap-2"><input type="checkbox" checked={form.permissions.includes(permission)} disabled={saving} onChange={(event) => set('permissions', event.target.checked ? [...form.permissions, permission] : form.permissions.filter((p) => p !== permission))} />{permission}</label>)}</div></details>
    <p className="text-xs text-muted-foreground">Değişiklikler yeni onaylara uygulanır. Mevcut kullanıcıların yetkileri kendiliğinden genişlemez.</p>
    {notice && <p role="status" className="text-sm">{notice}</p>}
    <Button disabled={saving || !form.permissions.length || (form.published && !form.representativeIds.length)} onClick={async () => {
      setNotice('');
      try { await save({ id: companyId, published: form.published, description: form.description, logoUrl: form.logoUrl,
        representativeIds: form.representativeIds, permissions: form.permissions, consentText: form.consentText, consentVersion: form.consentVersion }).unwrap(); setNotice('Partner katalog ayarları kaydedildi.'); }
      catch (cause) { setNotice(cause?.data?.message || cause?.normalizedMessage || 'Katalog kaydedilemedi.'); }
    }}>{saving ? 'Kaydediliyor…' : 'Katalog ayarlarını kaydet'}</Button>
  </section>;
}
