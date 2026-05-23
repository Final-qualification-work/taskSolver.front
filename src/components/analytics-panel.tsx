"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Layers,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { DashboardAnalytics, DistributionChartData, LoadChartData } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  done: "#34d399",
  "in progress": "#60a5fa",
  todo: "#a78bfa",
  backlog: "#94a3b8",
  "not groomed": "#f87171",
};
const TAG_COLORS = ["#60a5fa", "#a78bfa", "#34d399"];
const PRIORITY_COLORS = ["#f87171", "#fbbf24", "#94a3b8"];
const LOAD_COLORS: Record<string, string> = {
  critical: "#f87171",
  warning: "#fbbf24",
  underloaded: "#60a5fa",
  normal: "#34d399",
};

function fmt(n: number): string {
  return n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
    ? `${(n / 1_000).toFixed(0)}K`
    : String(n);
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  trend,
  onClick,
  hint,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  accent: string;
  trend?: "up" | "neutral" | "down";
  onClick?: () => void;
  hint?: string;
}) {
  const trendColor =
    trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-slate-400";
  const clickable = !!onClick;
  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      title={hint}
      className={cn(
        "group flex flex-col justify-between rounded-2xl bg-surface p-5 ring-1 ring-border-soft/60 transition-all",
        clickable
          ? "cursor-pointer hover:ring-2 hover:ring-accent-primary/40 hover:shadow-lg active:scale-[0.98]"
          : "hover:shadow-lg",
      )}
    >
      <div className="flex items-start justify-between">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl transition-transform",
            accent,
            clickable && "group-hover:scale-110",
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        {trend && (
          <TrendingUp
            className={cn(
              "h-4 w-4",
              trendColor,
              trend === "down" && "rotate-180",
            )}
          />
        )}
      </div>
      <div className="mt-4">
        <p className="text-3xl font-bold tracking-tight">{value}</p>
        <p className="mt-0.5 text-sm font-medium text-warm-muted">{label}</p>
        {sub && <p className="mt-1 text-xs text-warm-muted/70">{sub}</p>}
        {clickable && (
          <p className="mt-2 text-[10px] text-warm-muted/50 group-hover:text-warm-muted transition-colors">
            Перейти →
          </p>
        )}
      </div>
    </div>
  );
}

const CustomBarTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; name: string; fill: string }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border-soft bg-surface px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-semibold">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.fill }} />
          <span className="text-warm-muted">{p.name}:</span>
          <span className="font-medium">{p.value}%</span>
        </div>
      ))}
    </div>
  );
};

const CustomPieTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { name: string; value: number; payload: { name: string } }[];
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border-soft bg-surface px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold">{payload[0].payload.name}</p>
      <p className="text-warm-muted">Задач: <span className="font-medium text-foreground">{payload[0].value}</span></p>
    </div>
  );
};

type AnalyticsPanelProps = {
  dashboard: DashboardAnalytics | null;
  loadChart: LoadChartData | null;
  distribution: DistributionChartData | null;
  projectFilterLabel?: string;
  canAccessOptimization?: boolean;
  onNavigate?: (tab: string) => void;
};

export function AnalyticsPanel({
  dashboard,
  loadChart,
  distribution,
  canAccessOptimization = false,
  onNavigate,
}: AnalyticsPanelProps) {
  const metrics = dashboard?.metrics;

  const statusPieData = distribution?.byStatus.map((s) => ({
    name: s.name,
    value: s.value,
    color: STATUS_COLORS[s.name] ?? "#94a3b8",
  })) ?? [];

  const tagPieData = distribution?.byTag.map((s, i) => ({
    name: s.name,
    value: s.value,
    color: TAG_COLORS[i % TAG_COLORS.length],
  })) ?? [];

  const priorityData = distribution?.byPriority.map((p) => ({
    name: p.label,
    value: p.count,
    color: PRIORITY_COLORS[3 - p.priority] ?? "#94a3b8",
  })) ?? [];

  const teamLoadRows = (loadChart?.data ?? []).map((t) => ({
    name: t.teamName,
    pct: Math.min(100, Number(t.loadPercentage)),
    load: t.currentLoad,
    capacity: t.capacity,
    status: t.status,
    tag: t.tag,
    color: LOAD_COLORS[t.status] ?? LOAD_COLORS.normal,
  }));

  const totalCost = Number(metrics?.totalCost ?? 0);
  const savings = Number(metrics?.estimatedSavings ?? 0);

  return (
    <div className="space-y-6">
      {}
      {metrics && (
        <div
          className={cn(
            "grid grid-cols-2 gap-3 sm:grid-cols-4",
            canAccessOptimization ? "lg:grid-cols-8" : "lg:grid-cols-6",
          )}
        >
          <StatCard
            label="Проектов"
            value={String(metrics.totalProjects)}
            icon={Layers}
            accent="bg-violet-500/20 text-violet-400"
            trend="neutral"
            onClick={() => onNavigate?.("Проекты")}
            hint="Перейти к проектам"
          />
          <StatCard
            label="Команд"
            value={String(metrics.totalTeams)}
            icon={Users}
            accent="bg-blue-500/20 text-blue-400"
            trend="neutral"
            onClick={() => onNavigate?.("Команды")}
            hint="Перейти к командам"
          />
          <StatCard
            label="Задач"
            value={String(metrics.totalTasks)}
            icon={CircleDot}
            accent="bg-cyan-500/20 text-cyan-400"
            onClick={() => onNavigate?.("Задачи")}
            hint="Перейти к задачам"
          />
          <StatCard
            label="Готово"
            value={`${metrics.completionRate}%`}
            icon={CheckCircle2}
            accent="bg-emerald-500/20 text-emerald-400"
            trend="up"
            onClick={() => onNavigate?.("Задачи")}
            hint="Перейти к выполненным задачам"
          />
          <StatCard
            label="Ср. загрузка"
            value={`${metrics.averageLoad}%`}
            sub={
              loadChart?.summary.criticalTeams
                ? `⚠ ${loadChart.summary.criticalTeams} перегружено`
                : undefined
            }
            icon={AlertTriangle}
            accent="bg-amber-500/20 text-amber-400"
            onClick={() => onNavigate?.("Команды")}
            hint="Перейти к загрузке команд"
          />
          {canAccessOptimization ? (
            <>
              <StatCard
                label="Затраты"
                value={`${fmt(totalCost)} ₽`}
                icon={Wallet}
                accent="bg-rose-500/20 text-rose-400"
                onClick={() => onNavigate?.("Оптимизация")}
                hint="Перейти к оптимизации стоимости"
              />
              <StatCard
                label="Экономия"
                value={`${fmt(savings)} ₽`}
                sub="vs. минимальная цена"
                icon={TrendingUp}
                accent="bg-teal-500/20 text-teal-400"
                trend="up"
                onClick={() => onNavigate?.("Оптимизация")}
                hint="Перейти к оптимизации"
              />
            </>
          ) : null}
          <StatCard
            label="Эффект-ть"
            value={`${metrics.efficiency}%`}
            sub="in progress + done"
            icon={Zap}
            accent="bg-yellow-500/20 text-yellow-400"
            onClick={() => onNavigate?.("Задачи")}
            hint="Перейти к задачам в работе"
          />
        </div>
      )}

      {}
      <div className="grid gap-4 lg:grid-cols-3">
        {}
        {teamLoadRows.length > 0 && (
          <div className="lg:col-span-2 rounded-2xl bg-surface p-5 ring-1 ring-border-soft/60">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">Загрузка команд</p>
                <p className="text-xs text-warm-muted">
                  Средняя {loadChart?.summary.averageLoad}% · критично{" "}
                  {loadChart?.summary.criticalTeams ?? 0}
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-[11px] text-warm-muted">
                {Object.entries(LOAD_COLORS).map(([key, color]) => (
                  <span key={key} className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                    {key}
                  </span>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {teamLoadRows.map((t) => (
                <div key={t.name}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase"
                        style={{ background: t.color + "22", color: t.color }}
                      >
                        {t.tag}
                      </span>
                      <span className="truncate text-sm font-medium">{t.name}</span>
                    </div>
                    <div className="shrink-0 flex items-center gap-2 text-xs text-warm-muted">
                      <span>{t.load}/{t.capacity} SP</span>
                      <span
                        className="font-semibold tabular-nums"
                        style={{ color: t.color }}
                      >
                        {t.pct}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-background">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${t.pct}%`, background: t.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {}
        {statusPieData.length > 0 && (
          <div className="rounded-2xl bg-surface p-5 ring-1 ring-border-soft/60">
            <p className="mb-1 font-semibold">По статусам</p>
            <p className="mb-4 text-xs text-warm-muted">Всего {distribution?.total ?? 0} задач</p>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={statusPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {statusPieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-3 space-y-1.5">
              {statusPieData.map((s) => (
                <div key={s.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                    <span className="text-warm-muted">{s.name}</span>
                  </span>
                  <span className="font-medium">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {}
      <div className="grid gap-4 sm:grid-cols-2">
        {}
        {tagPieData.length > 0 && (
          <div className="rounded-2xl bg-surface p-5 ring-1 ring-border-soft/60">
            <p className="mb-1 font-semibold">По технологиям</p>
            <p className="mb-4 text-xs text-warm-muted">Распределение задач по тегам</p>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={tagPieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                  labelLine={false}
                >
                  {tagPieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {}
        {priorityData.length > 0 && (
          <div className="rounded-2xl bg-surface p-5 ring-1 ring-border-soft/60">
            <p className="mb-1 font-semibold">По приоритету</p>
            <p className="mb-4 text-xs text-warm-muted">Распределение задач</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={priorityData} layout="vertical" margin={{ left: 0, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={55} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-surface, #1e2030)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {priorityData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {}
      {(dashboard?.projectStats ?? []).length > 0 && (
        <div className="rounded-2xl bg-surface p-5 ring-1 ring-border-soft/60">
          <p className="mb-4 font-semibold">Проекты</p>
          <div className="space-y-3">
            {(dashboard?.projectStats ?? []).map((p) => {
              const pct = Math.min(100, Number(p.completionRate));
              const statusMeta: Record<string, { label: string; color: string }> = {
                active:    { label: "Активный",      color: "#34d399" },
                planning:  { label: "Планирование",  color: "#60a5fa" },
                completed: { label: "Завершён",       color: "#94a3b8" },
                on_hold:   { label: "Пауза",          color: "#fbbf24" },
              };
              const meta = statusMeta[p.status] ?? { label: p.status, color: "#94a3b8" };
              const budgetPct = p.budget && p.budget > 0
                ? Math.min(100, (p.spent / p.budget) * 100)
                : null;

              return (
                <div
                  key={p.id}
                  className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 rounded-xl bg-background px-4 py-3"
                >
                  {}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: meta.color }}
                      />
                      <p className="truncate text-sm font-semibold">{p.name}</p>
                    </div>
                    {}
                    <div className="mt-2">
                      <div className="mb-1 flex justify-between text-xs text-warm-muted">
                        <span>{p.completedTasks}/{p.totalTasks} задач выполнено</span>
                        <span className="font-semibold" style={{ color: meta.color }}>{pct}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: meta.color }}
                        />
                      </div>
                    </div>
                    {}
                    {canAccessOptimization && budgetPct !== null && (
                      <div className="mt-1.5">
                        <div className="mb-1 flex justify-between text-[11px] text-warm-muted">
                          <span>Бюджет {p.budget!.toLocaleString("ru")} ₽</span>
                          <span className={cn(budgetPct > 90 ? "text-rose-400" : "")}>
                            потрачено {p.spent.toLocaleString("ru")} ₽
                          </span>
                        </div>
                        <div className="h-1 overflow-hidden rounded-full bg-surface">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${budgetPct}%`,
                              background: budgetPct > 90 ? "#f87171" : "#a78bfa",
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {}
                  <div className="flex items-start">
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                      style={{ background: meta.color + "22", color: meta.color }}
                    >
                      {meta.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
