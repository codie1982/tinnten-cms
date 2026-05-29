import { Wrench } from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/**
 * Genel amaçlı placeholder sayfa. Arayüz iskeleti hazır olan ama henüz API
 * bağlantısı yapılmamış sayfalar için tutarlı bir görünüm sağlar.
 *
 * props: section, title, description, roles?, icon?, note?
 */
export function PlaceholderPage({
  section,
  title,
  description,
  roles,
  icon: Icon = Wrench,
  note,
}) {
  const body = (
    <>
      <PageHeader section={section} title={title} description={description} />

      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-5 py-20 text-center">
          <span className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="size-8" />
          </span>
          <div className="space-y-1.5">
            <div className="flex items-center justify-center gap-2">
              <p className="text-base font-semibold text-foreground">{title}</p>
              <Badge variant="warning">Yapım aşamasında</Badge>
            </div>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              {note ||
                'Bu sayfanın arayüz iskeleti hazır. Veri ve API bağlantısı bir sonraki aşamada eklenecek.'}
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  );

  if (roles) return <RoleGuard allowedRoles={roles}>{body}</RoleGuard>;
  return body;
}
