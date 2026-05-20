"use client";

import { DashboardAnalytics, DistributionChartData, LoadChartData } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SimpleBarChart } from "@/components/simple-bar-chart";

const loadStatusColor: Record<string, string> = {
  critical: "bg-accent-danger/80",
  warning: "bg-amber-500/80",
  underloaded: "bg-sky-500/70",
  normal: "bg-accent-primary/70",
};

type AnalyticsPanelProps = {
  dashboard: DashboardAnalytics | null;
  loadChart: LoadChartData | null;
  distribution: DistributionChartData | null;
  projectFilterLabel?: string;
};

export function AnalyticsPanel({
  dashboard,
  loadChart,
  distribution,
  projectFilterLabel,
}: AnalyticsPanelProps) {
  const metrics = dashboard?.metrics;

  return (
    <div className="space-y-4">
      {metrics && (
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
          {[
            ["Проектов", String(metrics.totalProjects)],
            ["Команд", String(metrics.totalTeams)],
            ["Задач", String(metrics.totalTasks)],
            ["Завершено", `${metrics.completionRate}%`],
            ["Средняя загрузка", `${metrics.averageLoad}%`],
            ["Затраты", `${Number(metrics.totalCost).toLocaleString("ru")} ₽`],
            ["Экономия (оценка)", `${Number(metrics.estimatedSavings).toLocaleString("ru")} ₽`],
            ["Эффективность", `${metrics.efficiency}%`],
          ].map(([label, value]) => (
            <Card key={label}>
              <CardHeader className="pb-2">
                <CardDescription>{label}</CardDescription>
                <CardTitle className="text-xl">{value}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {loadChart && (
          <Card>
            <CardHeader>
              <CardTitle>{loadChart.title}</CardTitle>
              <CardDescription>
                API: /visualization/load-chart · средняя загрузка {loadChart.summary.averageLoad}%
                {loadChart.summary.criticalTeams > 0
                  ? ` · перегружено: ${loadChart.summary.criticalTeams}`
                  : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SimpleBarChart
                items={loadChart.data.map((t) => ({
                  label: t.teamName,
                  value: Number(t.loadPercentage),
                  hint: `${t.currentLoad}/${t.capacity} SP`,
                  colorClass: loadStatusColor[t.status] ?? loadStatusColor.normal,
                }))}
                valueSuffix="%"
                maxValue={100}
              />
            </CardContent>
          </Card>
        )}

        {distribution && (
          <Card>
            <CardHeader>
              <CardTitle>Распределение задач</CardTitle>
              <CardDescription>
                API: /visualization/task-distribution
                {projectFilterLabel ? ` · ${projectFilterLabel}` : ""} · всего {distribution.total}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-warm-muted">По статусам</p>
                <SimpleBarChart
                  items={distribution.byStatus.map((s) => ({ label: s.name, value: s.value }))}
                />
              </div>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-warm-muted">По тегам</p>
                <SimpleBarChart
                  items={distribution.byTag.map((s) => ({ label: s.name, value: s.value }))}
                />
              </div>
              {distribution.byTeam.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-warm-muted">По командам</p>
                  <SimpleBarChart
                    items={distribution.byTeam.map((s) => ({ label: s.name, value: s.value }))}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {dashboard?.projectStats && dashboard.projectStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Проекты</CardTitle>
            <CardDescription>Прогресс и бюджет из /visualization/dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {dashboard.projectStats.map((p) => (
                <div key={p.id} className="rounded-xl bg-background p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{p.name}</p>
                    <span className="text-xs text-warm-muted">{p.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-warm-muted">
                    {p.completedTasks}/{p.totalTasks} задач · {p.completionRate}%
                  </p>
                  {p.budget != null && (
                    <p className="mt-1 text-xs text-warm-muted">
                      Бюджет {p.budget.toLocaleString("ru")} ₽ · потрачено {p.spent.toLocaleString("ru")} ₽
                    </p>
                  )}
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface">
                    <div
                      className="h-full rounded-full bg-accent-primary/70"
                      style={{ width: `${Math.min(100, Number(p.completionRate))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
