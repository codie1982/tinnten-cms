'use client';

import { useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Coins, DollarSign, MessageSquare, Loader2 } from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { CMS_ROLES, canAccess } from '@/lib/roles';
import { useGetUsageSeriesQuery } from '@/redux/services';

const RANGES = [
  { value: '24h', label: 'Son 24 Saat' },
  { value: '7d', label: 'Son 7 Gün' },
  { value: '30d', label: 'Son 30 Gün' },
];

function formatBucketLabel(bucket, range) {
  if (!bucket) return '';
  if (range === '24h') {
    // "2026-05-29T14:00" → "14:00"
    const t = bucket.split('T')[1];
    return t || bucket;
  }
  // "2026-05-29" → "29.05"
  const parts = bucket.split('-');
  return parts.length === 3 ? `${parts[2]}.${parts[1]}` : bucket;
}

const numberTr = (n) => Number(n || 0).toLocaleString('tr-TR');

export default function CmsUsagePage() {
  const { data: session } = useSession();
  const authorized = canAccess(session?.roles ?? [], [CMS_ROLES.ACCESS]);

  const [range, setRange] = useState('7d');
  const { data, isLoading, isFetching, error } = useGetUsageSeriesQuery(range, { skip: !authorized });

  const series = data?.series ?? [];
  const totals = data?.totals ?? { totalTokens: 0, totalCost: 0, count: 0 };

  const chartData = useMemo(
    () =>
      series.map((s) => ({
        label: formatBucketLabel(s.bucket, range),
        tokens: s.totalTokens,
        cost: s.totalCost,
        requests: s.count,
      })),
    [series, range],
  );

  const hasData = chartData.length > 0;

  return (
    <RoleGuard allowedRoles={[CMS_ROLES.ACCESS]}>
      <PageHeader
        section="Yapay Zeka"
        title="Kullanım"
        description="Tüm asistanların LLM token kullanımı ve maliyet eğrileri"
      />

      {/* Aralık seçici */}
      <div className="mb-5 inline-flex rounded-lg border border-border bg-card p-1">
        {RANGES.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => setRange(r.value)}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
              range === r.value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* KPI kartları */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard icon={Coins} label="Toplam Token" value={numberTr(totals.totalTokens)} loading={isLoading} />
        <KpiCard icon={DollarSign} label="Toplam Maliyet" value={`$${Number(totals.totalCost || 0).toFixed(2)}`} loading={isLoading} />
        <KpiCard icon={MessageSquare} label="İstek Sayısı" value={numberTr(totals.count)} loading={isLoading} />
      </div>

      {/* Grafik */}
      <Card>
        <CardHeader>
          <CardTitle>Token Kullanım Eğrisi — {RANGES.find((r) => r.value === range)?.label}</CardTitle>
        </CardHeader>
        <CardContent className="relative p-4">
          {isFetching && !isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          )}

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Kullanım verisi yüklenemedi</AlertTitle>
              <AlertDescription>
                {error?.data?.message || error?.normalizedMessage || 'Sunucuya ulaşılamadı.'}
              </AlertDescription>
            </Alert>
          ) : isLoading ? (
            <Skeleton className="h-[320px] w-full" />
          ) : !hasData ? (
            <div className="flex h-[320px] flex-col items-center justify-center gap-2 text-center">
              <Coins className="size-6 text-muted-foreground" />
              <p className="font-semibold text-foreground">Veri yok</p>
              <p className="text-sm text-muted-foreground">Bu aralıkta kullanım kaydı bulunmuyor.</p>
            </div>
          ) : (
            <div className="h-[340px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="tokenFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={16}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                    width={56}
                    tickFormatter={(v) => numberTr(v)}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid hsl(var(--border))',
                      fontSize: 12,
                    }}
                    formatter={(value, name) => {
                      if (name === 'tokens') return [numberTr(value), 'Token'];
                      return [value, name];
                    }}
                    labelClassName="text-xs"
                  />
                  <Area
                    type="monotone"
                    dataKey="tokens"
                    stroke="#6366F1"
                    strokeWidth={2}
                    fill="url(#tokenFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </RoleGuard>
  );
}

function KpiCard({ icon: Icon, label, value, loading }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="mt-1 h-6 w-24" />
          ) : (
            <p className="text-xl font-semibold text-foreground">{value}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
