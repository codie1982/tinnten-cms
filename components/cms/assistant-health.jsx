'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Asistan sağlık göstergeleri.
//
//  • <AssistantHealthCell>  — liste satırı: puan + bant rozeti, hover'da sorunlar
//  • <AssistantHealthPanel> — detay sayfası: sorun listesi + ölçülen gerçekler
//
// Kural yok, hesap yok: her ikisi de backend'in ürettiği raporu boyar.
// ─────────────────────────────────────────────────────────────────────────────

import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  HEALTH_SEVERITY_META,
  formatHealthCount,
  healthIssueLabel,
  healthLevelMeta,
} from '@/lib/assistant-health';

const SEVERITY_ICON = {
  critical: ShieldAlert,
  warning: AlertTriangle,
  info: Info,
};

/** Puanın rengi bant ile aynı olmalı — rozet yeşil, sayı kırmızı olmasın. */
const SCORE_CLASS = {
  critical: 'text-destructive',
  weak: 'text-amber-600 dark:text-amber-500',
  fair: 'text-primary',
  good: 'text-green-600 dark:text-green-500',
};

/**
 * Liste hücresi. `title` ile sorunlar hover'da tam liste olarak görünür —
 * tabloyu şişirmeden "neden düşük?" sorusunu cevaplar.
 */
export function AssistantHealthCell({ health }) {
  if (!health) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const meta = healthLevelMeta(health.level);
  const issues = health.issues ?? [];
  const critical = health.counts?.critical ?? 0;

  const tooltip = issues.length
    ? issues
        .map((i) => `• ${healthIssueLabel(i.id)} (${HEALTH_SEVERITY_META[i.severity]?.label ?? i.severity})`)
        .join('\n')
    : 'Denetimde sorun bulunmadı.';

  return (
    <div className="flex items-center gap-2 whitespace-nowrap" title={tooltip}>
      <span className={cn('font-mono text-sm font-semibold', SCORE_CLASS[health.level])}>
        {health.score}
      </span>
      <Badge variant={meta.variant}>{meta.label}</Badge>
      {critical > 0 && (
        <span className="inline-flex items-center gap-0.5 text-xs text-destructive">
          <ShieldAlert className="size-3.5" />
          {critical}
        </span>
      )}
    </div>
  );
}

/** Detay sayfası paneli — sorunlar + denetimin baktığı ham sayımlar. */
export function AssistantHealthPanel({ health }) {
  if (!health) {
    return (
      <p className="text-sm text-muted-foreground">
        Bu asistan için sağlık raporu üretilemedi.
      </p>
    );
  }

  const meta = healthLevelMeta(health.level);
  const issues = health.issues ?? [];
  const facts = health.facts ?? {};
  const catalog = facts.catalogCounts ?? {};

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className={cn('font-mono text-3xl font-bold', SCORE_CLASS[health.level])}>
          {health.score}
          <span className="text-base font-normal text-muted-foreground">/100</span>
        </span>
        <Badge variant={meta.variant}>{meta.label}</Badge>
        {health.requiresPublishConfirmation && (
          <span className="text-xs text-muted-foreground">
            Kullanıcı yayınlarken ek onay istenir
          </span>
        )}
      </div>

      {issues.length === 0 ? (
        <div className="flex items-start gap-2 rounded-lg border border-green-500/30 bg-green-500/5 p-3">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" />
          <p className="text-sm text-foreground">
            Denetimde sorun bulunmadı — asistanın kaynakları ve yetenekleri tutarlı.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {issues.map((issue) => {
            const Icon = SEVERITY_ICON[issue.severity] ?? Info;
            const sev = HEALTH_SEVERITY_META[issue.severity] ?? {};
            return (
              <li
                key={issue.id}
                className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3"
              >
                <Icon className={cn('mt-0.5 size-4 shrink-0', sev.className)} />
                <div className="min-w-0">
                  <p className="text-sm text-foreground">{healthIssueLabel(issue.id)}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {issue.id} · {sev.label ?? issue.severity}
                    {typeof issue.penalty === 'number' ? ` · −${issue.penalty}` : ''}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Denetimin baktığı ham sayımlar — "puan neden düşük?" sorusunu
          ikinci bir araştırma yapmadan cevaplar. "ölçülemedi" ile "0" ayrı. */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Ölçülen değerler
        </p>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
          <FactItem label="Firmada indeksli site" value={formatHealthCount(facts.readyWebsiteCount)} />
          <FactItem label="Bağlı kaynak" value={String(health.sourceCount ?? 0)} />
          {/* Firma genelinde indeksli site olması, BU asistanın bağladığı
              sitenin taranmış olduğu anlamına gelmez — ayrı gösteriliyor. */}
          <FactItem
            label="Bağlı & indeksli site"
            value={formatHealthCount(facts.linkedReadyWebsiteCount)}
          />
          <FactItem label="Aktif ürün" value={formatHealthCount(catalog.product)} />
          <FactItem label="Aktif hizmet" value={formatHealthCount(catalog.service)} />
          <FactItem label="Randevulu hizmet" value={formatHealthCount(catalog.booking)} />
          <FactItem label="Teklif bazlı hizmet" value={formatHealthCount(catalog.offer)} />
        </dl>
      </div>
    </div>
  );
}

function FactItem({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-mono text-sm text-foreground">{value}</dd>
    </div>
  );
}
