'use client';

/**
 * CMS asistan sihirbazı — dashboard'daki 7 adımlı akışın kısıtsız karşılığı.
 *
 * Dashboard akışından farkları tek yerde toplanır:
 *  - Firma OPSİYONEL (havuz asistanı oluşturulabilir, sonradan aktarılır).
 *  - Tool/capability görünürlüğünde iş modu, "çok yakında" ve gizli tool
 *    filtreleri yok (bkz. lib/assistant-capabilities.js).
 *  - Sözleşme onayı ve yayın kotası akışı yok — asistan taslak doğar.
 */

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Loader2,
  Palette,
  Rocket,
  Sparkles,
  Target,
  UserRound,
} from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import CompanySelect from '@/components/cms/company-select';
import { CMS_ROLES } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { useAssistantWizard } from '@/hooks/use-assistant-wizard';
import { Field } from '@/components/cms/assistant-wizard/shared';
import {
  AppearanceStep,
  ProfileStep,
  PromptStep,
} from '@/components/cms/assistant-wizard/basic-steps';
import { CapabilitiesStep } from '@/components/cms/assistant-wizard/capabilities-step';
import { LibraryStep } from '@/components/cms/assistant-wizard/library-step';
import { IntentsStep } from '@/components/cms/assistant-wizard/intents-step';
import { PublishStep } from '@/components/cms/assistant-wizard/publish-step';

const STEP_ICONS = {
  profile: UserRound,
  prompt: Sparkles,
  appearance: Palette,
  capabilities: ListChecks,
  library: BookOpen,
  intents: Target,
  publish: Rocket,
};

const PHASE_LABELS = {
  generating: 'Intent metinleri üretiliyor…',
  creating: 'Asistan oluşturuluyor…',
  saving: 'Tool tanımları kaydediliyor…',
};

export default function NewAssistantPage() {
  useSession();
  const w = useAssistantWizard();

  const idx = w.steps.findIndex((s) => s.key === w.step);
  const isFirst = idx <= 0;
  const isLast = idx === w.steps.length - 1;
  const busy = w.saving || w.submitted;

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.ADMIN]}>
      <PageHeader
        breadcrumb={[{ label: 'Asistanlar', href: '/cms/assistants' }, { label: 'Yeni Asistan' }]}
        title="Yeni Asistan"
        description="Kimlik, yetenekler, bilgi tabanı, intent ve yayın ayarlarını tek akışta tanımlayın"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/cms/assistants" className={buttonVariants({ variant: 'outline' })}>
              <ChevronLeft className="size-4" />
              Listeye dön
            </Link>
            <Button onClick={w.submit} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
              Asistanı Oluştur
            </Button>
          </div>
        }
      />

      {w.submitError && (
        <Alert variant="destructive" className="mb-5">
          <AlertTitle>Asistan oluşturulamadı</AlertTitle>
          <AlertDescription>{w.submitError}</AlertDescription>
        </Alert>
      )}

      {busy && w.phase && (
        <Alert variant="info" className="mb-5">
          <AlertDescription>
            <span className="inline-flex items-center gap-2">
              <Loader2 className="size-3.5 animate-spin" />
              {PHASE_LABELS[w.phase]}
            </span>
          </AlertDescription>
        </Alert>
      )}

      {/* Firma seçimi adımların DIŞINDA: her adımdaki kapsam/kaynak seçicileri
          bu değere bağlı (ürün listesi, web içerikleri), bir adıma gömülü
          olsaydı operatör geri dönüp değiştirmek zorunda kalırdı. */}
      <Card className="mb-5">
        <CardContent className="grid gap-4 p-4 sm:grid-cols-[minmax(0,320px)_1fr] sm:items-start">
          <Field
            label="Firma"
            hint="Boş bırakılırsa asistan firmasız (havuzda) oluşur; listeden istediğiniz zaman aktarabilirsiniz."
          >
            <CompanySelect
              value={w.companyId}
              onChange={(v) => w.set('companyId', v)}
              placeholder="Firma seç (opsiyonel)"
            />
          </Field>
          <div className="flex flex-wrap gap-2 sm:justify-end sm:pt-5">
            <Badge variant="muted">{w.enabledToolsPayload.length} tool</Badge>
            <Badge variant={w.promptValidation.valid ? 'success' : 'warning'}>
              {w.promptValidation.valid ? 'Prompt hazır' : 'Prompt eksik'}
            </Badge>
            {w.companyId ? (
              <Badge variant="primary">Firmaya bağlı</Badge>
            ) : (
              <Badge variant="warning">Atanmamış</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Adım şeridi */}
      <Card className="mb-5">
        <CardContent className="p-2">
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-7">
            {w.steps.map((s, i) => {
              const Icon = STEP_ICONS[s.key];
              const active = w.step === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => w.setStep(s.key)}
                  className={cn(
                    'flex min-w-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground/70 hover:bg-accent hover:text-foreground',
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate">{s.label}</span>
                  <span className="ms-auto shrink-0 text-[10px] text-muted-foreground">{i + 1}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {w.step === 'profile' && <ProfileStep value={w.profile} onChange={(v) => w.set('profile', v)} />}
      {w.step === 'prompt' && (
        <PromptStep value={w.prompt} onChange={(v) => w.set('prompt', v)} validation={w.promptValidation} />
      )}
      {w.step === 'appearance' && (
        <AppearanceStep value={w.appearance} onChange={(v) => w.set('appearance', v)} />
      )}
      {w.step === 'capabilities' && <CapabilitiesStep w={w} />}
      {w.step === 'library' && <LibraryStep w={w} />}
      {w.step === 'intents' && <IntentsStep w={w} />}
      {w.step === 'publish' && <PublishStep w={w} />}

      <div className="mt-5 flex items-center justify-between gap-3">
        <Button
          variant="outline"
          disabled={isFirst}
          onClick={() => w.setStep(w.steps[idx - 1].key)}
        >
          <ChevronLeft className="size-4" />
          Önceki
        </Button>
        {isLast ? (
          <Button onClick={w.submit} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
            Asistanı Oluştur
          </Button>
        ) : (
          <Button variant="outline" onClick={() => w.setStep(w.steps[idx + 1].key)}>
            Sonraki
            <ChevronRight className="size-4" />
          </Button>
        )}
      </div>
    </RoleGuard>
  );
}
