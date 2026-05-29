'use client';

import { useMemo, useState } from 'react';
import {
  Coins,
  TrendingUp,
  Zap,
  DollarSign,
  Bot,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CMS_ROLES } from '@/lib/roles';
import { cn } from '@/lib/utils';

/* ─── mock token usage data ─── */
const usageByAssistant = [
  { id: 'AS-1042', name: 'Satış Asistanı', model: 'gpt-4o', inputTokens: 4_820_000, outputTokens: 1_240_000, requests: 18420, cost: 142.8, trend: +12.4 },
  { id: 'AS-1043', name: 'Destek Botu', model: 'claude-sonnet', inputTokens: 3_110_000, outputTokens: 980_000, requests: 14210, cost: 98.5, trend: +6.1 },
  { id: 'AS-1051', name: 'İçerik Üretici', model: 'gpt-4o', inputTokens: 2_540_000, outputTokens: 2_010_000, requests: 6320, cost: 121.3, trend: -3.2 },
  { id: 'AS-1067', name: 'Tedarikçi Eşleştirici', model: 'gpt-4o-mini', inputTokens: 6_200_000, outputTokens: 410_000, requests: 28900, cost: 34.7, trend: +21.8 },
  { id: 'AS-1072', name: 'Çeviri Asistanı', model: 'claude-haiku', inputTokens: 1_890_000, outputTokens: 640_000, requests: 9870, cost: 18.2, trend: +1.5 },
];

const modelMeta = {
  'gpt-4o': { label: 'GPT-4o', variant: 'primary' },
  'gpt-4o-mini': { label: 'GPT-4o mini', variant: 'secondary' },
  'claude-sonnet': { label: 'Claude Sonnet', variant: 'success' },
  'claude-haiku': { label: 'Claude Haiku', variant: 'muted' },
};

function fmtToken(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function KpiCard({ icon: Icon, tint, label, value, sub, trend }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className={cn('flex size-10 items-center justify-center rounded-xl', tint)}>
            <Icon className="size-5" />
          </div>
          {trend != null && (
            <span className={cn('flex items-center gap-0.5 text-xs font-medium', trend >= 0 ? 'text-emerald-600' : 'text-red-500')}>
              {trend >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              {Math.abs(trend)}%
            </span>
          )}
        </div>
        <p className="mt-3 text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-2sm text-muted-foreground">{label}</p>
        {sub && <p className="mt-1 text-xs text-muted-foreground/70">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function AssistantUsagePage() {
  const [period, setPeriod] = useState('30d');

  const totals = useMemo(() => {
    const input = usageByAssistant.reduce((s, a) => s + a.inputTokens, 0);
    const output = usageByAssistant.reduce((s, a) => s + a.outputTokens, 0);
    const requests = usageByAssistant.reduce((s, a) => s + a.requests, 0);
    const cost = usageByAssistant.reduce((s, a) => s + a.cost, 0);
    return { input, output, requests, cost };
  }, []);

  const maxTokens = Math.max(...usageByAssistant.map((a) => a.inputTokens + a.outputTokens));

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.ACCESS]}>
      <PageHeader
        section="Yapay Zeka"
        title="Token Kullanımı"
        description="AI asistanlarının token tüketimini ve maliyetlerini izleyin"
        actions={
          <div className="w-40">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Son 7 gün</SelectItem>
                <SelectItem value="30d">Son 30 gün</SelectItem>
                <SelectItem value="90d">Son 90 gün</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      {/* KPI cards */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Coins} tint="bg-violet-500/10 text-violet-600" label="Toplam Girdi Token" value={fmtToken(totals.input)} sub="input tokens" trend={10.2} />
        <KpiCard icon={Zap} tint="bg-blue-500/10 text-blue-600" label="Toplam Çıktı Token" value={fmtToken(totals.output)} sub="output tokens" trend={7.8} />
        <KpiCard icon={TrendingUp} tint="bg-amber-500/10 text-amber-600" label="Toplam İstek" value={totals.requests.toLocaleString('tr-TR')} sub="API çağrısı" trend={14.1} />
        <KpiCard icon={DollarSign} tint="bg-emerald-500/10 text-emerald-600" label="Tahmini Maliyet" value={'$' + totals.cost.toFixed(2)} sub="bu dönem" trend={-2.4} />
      </div>

      {/* Per-assistant table */}
      <Card>
        <CardHeader>
          <CardTitle>Asistan Bazlı Kullanım</CardTitle>
          <CardToolbar>
            <Badge variant="muted">{usageByAssistant.length} asistan</Badge>
          </CardToolbar>
        </CardHeader>
        <CardContent className="px-0 py-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asistan</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Girdi / Çıktı</TableHead>
                  <TableHead>Toplam Kullanım</TableHead>
                  <TableHead>İstek</TableHead>
                  <TableHead>Maliyet</TableHead>
                  <TableHead>Trend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usageByAssistant.map((a) => {
                  const total = a.inputTokens + a.outputTokens;
                  const pct = Math.round((total / maxTokens) * 100);
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Bot className="size-3.5" />
                          </span>
                          <div>
                            <p className="text-sm font-medium leading-none">{a.name}</p>
                            <p className="font-mono text-[11px] text-muted-foreground">{a.id}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={modelMeta[a.model]?.variant}>{modelMeta[a.model]?.label}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {fmtToken(a.inputTokens)} / {fmtToken(a.outputTokens)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="font-mono text-xs text-muted-foreground">{fmtToken(total)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{a.requests.toLocaleString('tr-TR')}</TableCell>
                      <TableCell className="font-mono text-sm font-medium">${a.cost.toFixed(2)}</TableCell>
                      <TableCell>
                        <span className={cn('flex items-center gap-0.5 text-xs font-medium', a.trend >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                          {a.trend >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                          {Math.abs(a.trend)}%
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </RoleGuard>
  );
}
