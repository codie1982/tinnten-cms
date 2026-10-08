'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@/components/ui/dialog';
import { useGetCmsPartnerAuthorizationsQuery } from '@/redux/services/companyPartnersApi';
const date = (value) => new Date(value).toLocaleString('tr-TR', { timeZoneName: 'short' });

export default function PartnerAuthorizationHistory({ relationId }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(false);
  const [afterId, setAfterId] = useState(undefined);
  const [eventsAfterId, setEventsAfterId] = useState(undefined);
  const { currentData: data, isFetching, error } = useGetCmsPartnerAuthorizationsQuery({ id: relationId, detail, afterId, eventsAfterId }, { skip: !open });
  return <><Button size="sm" variant="outline" onClick={() => { setAfterId(undefined); setEventsAfterId(undefined); setDetail(false); setOpen(true); }}>Onay geçmişi</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>Partner yetkilendirme geçmişi</DialogTitle></DialogHeader><DialogBody className="max-h-[75vh] space-y-4 overflow-y-auto">
      <Button variant="outline" disabled={isFetching} onClick={() => setDetail(!detail)}>{detail ? 'Bilgileri maskele' : 'Onay anındaki bilgileri göster'}</Button>
      {isFetching && <p>Yükleniyor…</p>}{error && <p role="alert" className="text-destructive">{error?.data?.message || 'Geçmiş yüklenemedi.'}</p>}
      {data?.items.length === 0 && <p>Bu ilişki için kayıtlı kullanıcı onayı bulunmuyor.</p>}
      {data?.items.map((item) => <article key={item.id} className="space-y-3 rounded-lg border border-border p-4 text-sm">
        <h3 className="font-semibold">{date(item.acceptedAt)} · {item.state}</h3>
        <p>Onay veren: {item.actorUserId}<br />IP: {item.ip}<br />Telefon: {item.snapshot?.phone.number || item.maskedPhone}<br />Tarayıcı: {item.userAgent}<br />İstek: {item.requestId || '—'}</p>
        <p>{item.consentText}</p><p>Metin sürümü: {item.consentVersion} · Katalog: {item.listingRevision} · Şablon: {item.templateVersion}</p>
        {item.snapshot && <div><p>Firma: {item.snapshot.company.name} · Partner: {item.snapshot.partner.name}</p><p>Adres: {item.snapshot.address?.addressLine || 'Paylaşılmadı'}</p>{item.snapshot.socials.map((social) => <p key={social.id}>{social.platform}: {social.link || social.handle}</p>)}</div>}
        <details><summary>Yetkiler ({item.permissions.length})</summary><ul className="mt-2 list-inside list-disc">{item.permissions.map((permission) => <li key={permission}>{permission}</li>)}</ul></details>
        <p className="break-all text-xs text-muted-foreground">Kayıt: {item.id} · İçerik özeti: {item.consentHash}</p>
      </article>)}
      <div className="flex gap-2">{afterId && <Button variant="outline" onClick={() => setAfterId(undefined)}>En yeni kayıtlar</Button>}{data?.nextCursor && <Button variant="outline" disabled={isFetching} onClick={() => setAfterId(data.nextCursor)}>Daha eski kayıtlar</Button>}</div>
      {data?.events.length > 0 && <details><summary>Olay geçmişi</summary><ul className="mt-3 space-y-2 text-sm">{data.events.map((event) => <li key={event._id}>{date(event.occurredAt)} · {event.eventType} · {event.ip} · {event.actorUserId}</li>)}</ul></details>}
      <div className="flex gap-2">{eventsAfterId && <Button variant="outline" onClick={() => setEventsAfterId(undefined)}>En yeni olaylar</Button>}{data?.eventsNextCursor && <Button variant="outline" disabled={isFetching} onClick={() => setEventsAfterId(data.eventsNextCursor)}>Daha eski olaylar</Button>}</div>
    </DialogBody></DialogContent></Dialog>
  </>;
}
