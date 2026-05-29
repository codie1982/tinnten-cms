import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * CMS Sayfa Şablonları
 * ─────────────────────────────────────────────
 * Tüm CMS sayfaları bu iki temel düzenden birini kullanır.
 *
 *  1) ListShell  — tek sütun, tam genişlik (liste/tablo sayfaları)
 *  2) SplitShell — ana içerik + sağ yan panel (detay/form sayfaları)
 *
 * ─── Liste sayfası kullanımı ─────────────────
 *
 *   export default function MyPage() {
 *     return (
 *       <RoleGuard allowedRoles={[...]}>
 *         <PageHeader section="..." title="..." actions={<Button>Ekle</Button>} />
 *
 *         {// Filtre toolbar — opsiyonel }
 *         <Card className="mb-5">
 *           <CardContent className="flex flex-wrap items-center gap-3 p-4">
 *             <SearchInput />
 *             <SelectFilter />
 *           </CardContent>
 *         </Card>
 *
 *         {// Ana veri kartı }
 *         <Card>
 *           <CardHeader>
 *             <CardTitle>Liste Başlığı</CardTitle>
 *             <CardToolbar>
 *               <Badge variant="muted">{count} kayıt</Badge>
 *             </CardToolbar>
 *           </CardHeader>
 *           <CardContent className="p-0">
 *             <Table>...</Table>
 *           </CardContent>
 *           <CardFooter>
 *             <Pagination />
 *           </CardFooter>
 *         </Card>
 *       </RoleGuard>
 *     );
 *   }
 *
 * ─── Detay / form sayfası kullanımı ──────────
 *
 *   export default function DetailPage() {
 *     return (
 *       <RoleGuard allowedRoles={[...]}>
 *         <PageHeader
 *           breadcrumb={[
 *             { label: 'Ana Sayfa', href: '/cms/list' },
 *             { label: 'Detay' },
 *           ]}
 *           title="Kayıt Detayı"
 *           actions={<Button variant="outline">İptal</Button>}
 *         />
 *         <SplitShell
 *           aside={
 *             <Card>
 *               <CardHeader><CardTitle>Özet</CardTitle></CardHeader>
 *               <CardContent>...</CardContent>
 *             </Card>
 *           }
 *         >
 *           <Card>
 *             <CardHeader><CardTitle>Bilgiler</CardTitle></CardHeader>
 *             <CardContent>...form...</CardContent>
 *           </Card>
 *         </SplitShell>
 *       </RoleGuard>
 *     );
 *   }
 */

/* ─────────────────────────────────────────────
   SplitShell — geniş ana alan + sabit yan panel
───────────────────────────────────────────── */

/**
 * @param {React.ReactNode} children    — sol (geniş) alan
 * @param {React.ReactNode} aside       — sağ yan panel içeriği
 * @param {'w-72'|'w-80'|'w-96'} asideWidth — yan panel genişliği (varsayılan: 'w-80')
 */
export function SplitShell({ children, aside, asideWidth = 'w-80', className }) {
  return (
    <div className={cn('flex items-start gap-5', className)}>
      <div className="min-w-0 flex-1 space-y-5">{children}</div>
      {aside && (
        <div className={cn('shrink-0 space-y-5', asideWidth)}>{aside}</div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   TabShell — sekme tabanlı detay sayfaları
───────────────────────────────────────────── */

/**
 * Tabs kullanan sayfalar için standart wrapper.
 * Tabs bileşenini doğrudan içine yerleştirin.
 *
 *   <TabShell>
 *     <Tabs defaultValue="general">
 *       <TabsList>...</TabsList>
 *       <TabsContent value="general"><Card>...</Card></TabsContent>
 *     </Tabs>
 *   </TabShell>
 */
export function TabShell({ children, className }) {
  return <div className={cn('space-y-5', className)}>{children}</div>;
}

/* ─────────────────────────────────────────────
   Yardımcı: EmptyState
   (tablo/liste boşsa gösterilir)
───────────────────────────────────────────── */

/**
 * @param {React.ReactNode} icon        — lucide-react ikonu elementi
 * @param {string} title
 * @param {string} description
 * @param {React.ReactNode} action      — opsiyonel aksiyon butonu
 */
export function EmptyState({ icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center gap-3 py-14 text-center', className)}>
      {icon && (
        <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          {icon}
        </span>
      )}
      <div className="space-y-1">
        <p className="font-semibold text-foreground">{title}</p>
        {description && (
          <p className="mx-auto max-w-xs text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Yardımcı: SkeletonRows
   (tablo yüklenirken gösterilir)
───────────────────────────────────────────── */

/**
 * @param {number} rows     — iskelet satır sayısı (varsayılan: 6)
 * @param {number} cols     — sütun sayısı (varsayılan: 5)
 */
export function SkeletonRows({ rows = 6, cols = 5 }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((__, j) => (
            <Skeleton key={j} className="h-4" />
          ))}
        </div>
      ))}
    </div>
  );
}
