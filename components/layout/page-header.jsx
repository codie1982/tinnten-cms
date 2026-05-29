import Link from 'next/link';

/**
 * PageHeader — Tüm CMS sayfalarının standart başlık alanı.
 *
 * Props:
 *   section     — üstte küçük kategori etiketi (ör. "Partnerler")
 *   title       — sayfa başlığı
 *   description — açıklama metni (opsiyonel)
 *   actions     — sağ taraf aksiyon slot'u (opsiyonel, ör. <Button>)
 *   breadcrumb  — [{ label, href? }] dizisi; varsa section'ın yerini alır
 *
 * Örnek:
 *   <PageHeader
 *     breadcrumb={[
 *       { label: 'Asistanlar', href: '/cms/assistants' },
 *       { label: 'Kütüphaneler' },
 *     ]}
 *     title="Kütüphaneler"
 *     description="Asistan kütüphanelerini yönetin"
 *     actions={<Button>Ekle</Button>}
 *   />
 */
export function PageHeader({ section, title, description, actions, breadcrumb }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        {/* Breadcrumb takes precedence over section */}
        {breadcrumb && breadcrumb.length > 0 ? (
          <nav aria-label="breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground">
            {breadcrumb.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && (
                  <span className="select-none text-border" aria-hidden>
                    /
                  </span>
                )}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="transition-colors hover:text-foreground"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="font-medium text-foreground">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : section ? (
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            {section}
          </p>
        ) : null}

        <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>

        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
