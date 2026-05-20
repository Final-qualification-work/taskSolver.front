"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BarChart3, FolderKanban, KanbanSquare, LayoutDashboard, Sparkles, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { api, TaskFilters } from "@/lib/api";
import {
  DashboardAnalytics,
  DistributionChartData,
  LoadChartData,
  OptimizationSolution,
  Project,
  TagType,
  TaskItem,
  TaskStats,
  TaskStatus,
  Team,
  TeamLoad,
  TeamTasksData,
  UserProfile,
} from "@/lib/types";
import { AnalyticsPanel } from "@/components/analytics-panel";
import { PreferencesPanel } from "@/components/preferences-panel";
import { ProjectsPanel } from "@/components/projects-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { clearAuthToken } from "@/lib/auth";

// ─── Constants ──────────────────────────────────────────────────────────────
const tabs = ["Обзор", "Проекты", "Задачи", "Команды", "Оптимизация"] as const;
const tagOptions: TagType[] = ["frontend", "backend", "ML"];
const statusOptions: TaskStatus[] = [
  "not groomed",
  "backlog",
  "todo",
  "in progress",
  "done",
];
const statusLabels: Record<TaskStatus, string> = {
  "not groomed": "Не проработано",
  backlog: "Backlog",
  todo: "Todo",
  "in progress": "В работе",
  done: "Готово",
};
const sortFields = [
  { value: "business_priority", label: "Приоритет" },
  { value: "complexity", label: "Сложность" },
  { value: "deadline", label: "Дедлайн" },
  { value: "name", label: "Название" },
  { value: "createdAt", label: "Дата создания" },
] as const;
const tabIcons: Record<(typeof tabs)[number], React.ReactNode> = {
  Обзор: <LayoutDashboard className="h-4 w-4" />,
  Проекты: <FolderKanban className="h-4 w-4" />,
  Задачи: <KanbanSquare className="h-4 w-4" />,
  Команды: <Users className="h-4 w-4" />,
  Оптимизация: <Sparkles className="h-4 w-4" />,
};

type OptimizeViewData = {
  summary?: {
    solutionsCount?: number;
    totalTeams?: number;
    totalTasks?: number;
  };
  paretoFront?: OptimizationSolution[];
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function TeamBalancerApp() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Обзор");
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamLoadData, setTeamLoadData] = useState<TeamLoad[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [taskStats, setTaskStats] = useState<TaskStats | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [optimizationData, setOptimizationData] = useState<OptimizeViewData | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [taskProjectFilter, setTaskProjectFilter] = useState<string>("__all__");
  const [createTaskProjectId, setCreateTaskProjectId] = useState<string>("");
  const [dashboardAnalytics, setDashboardAnalytics] = useState<DashboardAnalytics | null>(null);
  const [loadChart, setLoadChart] = useState<LoadChartData | null>(null);
  const [taskDistribution, setTaskDistribution] = useState<DistributionChartData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [selectedOptimizationPoint, setSelectedOptimizationPoint] = useState<string>("");

  // Task view / filters
  const [taskView, setTaskView] = useState<"kanban" | "table">("kanban");
  const [taskFilters, setTaskFilters] = useState<TaskFilters>({
    sort_by: "business_priority",
    sort_order: "DESC",
    page: 1,
    limit: 50,
  });
  const [dragTaskId, setDragTaskId] = useState<number | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const [bulkStatus, setBulkStatus] = useState<TaskStatus | "">("");
  const [bulkAssignedTeamId, setBulkAssignedTeamId] = useState<string>("__keep__");
  const [bulkPriority, setBulkPriority] = useState<string>("");

  // Team filters / search
  const [teamSearch, setTeamSearch] = useState("");
  const [teamTagFilter, setTeamTagFilter] = useState("");

  // Refetch trigger
  const [fetchTick, setFetchTick] = useState(0);
  function reloadData() {
    setFetchTick((t) => t + 1);
  }

  // Modals
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [taskDraft, setTaskDraft] = useState<Partial<TaskItem> | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamDraft, setTeamDraft] = useState<Partial<Team> | null>(null);
  const [selectedTeamTasks, setSelectedTeamTasks] = useState<TeamTasksData | null>(null);
  const [isTeamTasksLoading, setIsTeamTasksLoading] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddTeam, setShowAddTeam] = useState(false);

  // Forms
  const [taskForm, setTaskForm] = useState({
    name: "",
    description: "",
    tag: "frontend" as TagType,
    complexity: 5,
    deadline: "",
    business_priority: 5,
    status: "backlog" as TaskStatus,
  });
  const [teamForm, setTeamForm] = useState({
    name: "",
    tag: "frontend" as TagType,
    cost: 2000,
    capacity: 40,
  });

  // ─── Data loading ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      setIsLoading(true);
      setError("");
      try {
        const [teamsResult, tasksResult, statsResult, loadResult, projectsResult] = await Promise.all([
          api.getTeams({ search: teamSearch || undefined, tag: teamTagFilter || undefined }),
          api.getTasks(taskFilters),
          api.getTaskStats(),
          api.getTeamLoad(),
          api.getProjects().catch(() => ({ data: [] as Project[] })),
        ]);
        const meResult = await api.getMe().catch(() => null);
        if (cancelled) return;
        setTeams(teamsResult.data || []);
        setTasks(tasksResult.data || []);
        setProjects(projectsResult.data || []);
        setTotalPages(tasksResult.totalPages ?? 1);
        setTaskStats(statsResult.data || null);
        setTeamLoadData(loadResult.data || []);
        setCurrentUser(meResult?.data ?? null);
        if (!createTaskProjectId && projectsResult.data?.length) {
          setCreateTaskProjectId(String(projectsResult.data[0].id));
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Не удалось загрузить данные");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchAll();
    return () => {
      cancelled = true;
    };
  }, [taskFilters, teamSearch, teamTagFilter, fetchTick]);

  useEffect(() => {
    if (activeTab !== "Обзор") return;
    let cancelled = false;

    async function loadAnalytics() {
      try {
        const projectId =
          taskProjectFilter !== "__all__" ? Number(taskProjectFilter) : undefined;
        const [dash, load, dist] = await Promise.all([
          api.getDashboardAnalytics(),
          api.getLoadChart(),
          api.getTaskDistribution(projectId),
        ]);
        if (cancelled) return;
        setDashboardAnalytics(dash.data);
        setLoadChart(load.data);
        setTaskDistribution(dist.data);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Не удалось загрузить аналитику");
        }
      }
    }

    loadAnalytics();
    return () => {
      cancelled = true;
    };
  }, [activeTab, taskProjectFilter, fetchTick]);

  // ─── Task actions ──────────────────────────────────────────────────────────
  async function createTask(e: FormEvent) {
    e.preventDefault();
    if (!createTaskProjectId) {
      setError("Выберите проект — задачи создаются внутри проекта");
      return;
    }
    try {
      await api.addTaskToProject(Number(createTaskProjectId), {
        ...taskForm,
        deadline: taskForm.deadline || new Date().toISOString(),
      });
      setTaskForm({
        name: "",
        description: "",
        tag: "frontend",
        complexity: 5,
        deadline: "",
        business_priority: 5,
        status: "backlog",
      });
      setShowAddTask(false);
      reloadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать задачу");
    }
  }

  async function updateTaskStatus(taskId: number, status: TaskStatus) {
    try {
      await api.updateTask(taskId, { status });
      reloadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось обновить статус");
    }
  }

  function toggleTaskSelection(taskId: number, checked: boolean) {
    setSelectedTaskIds((prev) => {
      if (checked) return prev.includes(taskId) ? prev : [...prev, taskId];
      return prev.filter((id) => id !== taskId);
    });
  }

  function toggleSelectAllVisibleTasks(checked: boolean) {
    if (checked) {
      setSelectedTaskIds(sortedTasks.map((task) => task.id));
      return;
    }
    setSelectedTaskIds([]);
  }

  async function applyBulkUpdate() {
    const visibleIds = new Set(sortedTasks.map((task) => task.id));
    const targetTaskIds = selectedTaskIds.filter((id) => visibleIds.has(id));
    if (!targetTaskIds.length) {
      setError("Выберите хотя бы одну задачу");
      return;
    }

    const hasStatus = bulkStatus !== "";
    const hasTeam = bulkAssignedTeamId !== "__keep__";
    const hasPriority = bulkPriority !== "";
    if (!hasStatus && !hasTeam && !hasPriority) {
      setError("Выберите хотя бы одну опцию массового обновления");
      return;
    }

    try {
      const updates = targetTaskIds.map((taskId) => ({
        taskId,
        ...(hasStatus ? { status: bulkStatus } : {}),
        ...(hasTeam
          ? { assignedTeamId: bulkAssignedTeamId === "__none__" ? null : Number(bulkAssignedTeamId) }
          : {}),
        ...(hasPriority ? { business_priority: Number(bulkPriority) } : {}),
      }));
      await api.bulkUpdateTasks(updates);
      setSelectedTaskIds([]);
      setBulkStatus("");
      setBulkAssignedTeamId("__keep__");
      setBulkPriority("");
      reloadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось выполнить массовое обновление");
    }
  }

  function handleLogout() {
    clearAuthToken();
    router.replace("/login");
  }

  async function deleteTask(taskId: number) {
    try {
      await api.deleteTask(taskId);
      setSelectedTask(null);
      setTaskDraft(null);
      reloadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось удалить задачу");
    }
  }

  async function saveTaskDraft(e: FormEvent) {
    e.preventDefault();
    if (!selectedTask || !taskDraft) return;
    try {
      await api.updateTask(selectedTask.id, taskDraft);
      setSelectedTask(null);
      setTaskDraft(null);
      reloadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось обновить задачу");
    }
  }

  function openTaskModal(task: TaskItem) {
    setSelectedTask(task);
    setTaskDraft({
      name: task.name,
      description: task.description,
      tag: task.tag,
      complexity: task.complexity,
      business_priority: task.business_priority,
      status: task.status,
      deadline: task.deadline?.slice(0, 16) || "",
      assignedTeamId: task.assignedTeamId,
    });
  }

  // ─── Team actions ──────────────────────────────────────────────────────────
  async function createTeam(e: FormEvent) {
    e.preventDefault();
    try {
      await api.createTeam(teamForm);
      setTeamForm({ name: "", tag: "frontend", cost: 2000, capacity: 40 });
      setShowAddTeam(false);
      reloadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать команду");
    }
  }

  async function deleteTeam(teamId: number) {
    try {
      await api.deleteTeam(teamId);
      reloadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось удалить команду");
    }
  }

  async function saveTeamDraft(e: FormEvent) {
    e.preventDefault();
    if (!selectedTeam || !teamDraft) return;
    try {
      await api.updateTeam(selectedTeam.id, teamDraft);
      setSelectedTeam(null);
      setTeamDraft(null);
      reloadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось обновить команду");
    }
  }

  function openTeamModal(team: Team) {
    setSelectedTeam(team);
    setTeamDraft({
      name: team.name,
      tag: team.tag,
      cost: team.cost,
      capacity: team.capacity,
    });
    setIsTeamTasksLoading(true);
    api
      .getTeamTasks(team.id)
      .then((result) => {
        setSelectedTeamTasks(result.data ?? null);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Не удалось загрузить задачи команды");
        setSelectedTeamTasks(null);
      })
      .finally(() => {
        setIsTeamTasksLoading(false);
      });
  }

  function toCsvValue(value: unknown): string {
    const text = String(value ?? "");
    const escaped = text.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  async function exportTasksCsv() {
    try {
      const pageSize = 100;
      const firstPage = await api.getTasks({ ...taskFilters, page: 1, limit: pageSize });
      const allTasks = [...(firstPage.data ?? [])];
      const totalPagesToLoad = firstPage.totalPages ?? 1;

      for (let page = 2; page <= totalPagesToLoad; page += 1) {
        const pageResult = await api.getTasks({ ...taskFilters, page, limit: pageSize });
        allTasks.push(...(pageResult.data ?? []));
      }

      const header = [
        "ID",
        "Название",
        "Описание",
        "Тег",
        "Статус",
        "Приоритет",
        "Сложность",
        "Дедлайн",
        "Команда",
      ];

      const rows = allTasks.map((task) => [
        task.id,
        task.name,
        task.description,
        task.tag,
        task.status,
        task.business_priority,
        task.complexity,
        task.deadline ? new Date(task.deadline).toISOString() : "",
        task.assignedTeam?.name ?? "",
      ]);

      const csvContent = [header, ...rows].map((row) => row.map(toCsvValue).join(",")).join("\n");
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `tasks_export_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось экспортировать задачи");
    }
  }

  // ─── Optimization ──────────────────────────────────────────────────────────
  async function runOptimization() {
    setIsLoading(true);
    setError("");
    try {
      const result = await api.optimize();
      setOptimizationData(result.data || null);
      setActiveTab("Оптимизация");
      setSelectedOptimizationPoint("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось выполнить оптимизацию");
    } finally {
      setIsLoading(false);
    }
  }

  async function applySelectedOptimization(point: string) {
    try {
      setIsLoading(true);
      setError("");
      await api.applyOptimization(point);
      setSelectedOptimizationPoint(point);
      reloadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось применить выбранное решение");
    } finally {
      setIsLoading(false);
    }
  }

  // ─── Derived data ──────────────────────────────────────────────────────────
  // Client-side sort — ensures order is always visible regardless of backend
  const projectFilteredTasks = useMemo(() => {
    if (taskProjectFilter === "__all__") return tasks;
    const pid = Number(taskProjectFilter);
    return tasks.filter((t) => t.projectId === pid);
  }, [tasks, taskProjectFilter]);

  const sortedTasks = (() => {
    const key = taskFilters.sort_by;
    const order = taskFilters.sort_order === "ASC" ? 1 : -1;
    if (!key) return projectFilteredTasks;
    return [...projectFilteredTasks].sort((a, b) => {
      const aVal = a[key as keyof TaskItem];
      const bVal = b[key as keyof TaskItem];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === "string" && typeof bVal === "string") {
        return order * aVal.localeCompare(bVal);
      }
      return order * (Number(aVal) - Number(bVal));
    });
  })();

  const groupedByStatus = useMemo(() => {
    return statusOptions.reduce<Record<TaskStatus, TaskItem[]>>(
      (acc, status) => {
        acc[status] = sortedTasks.filter((task) => task.status === status);
        return acc;
      },
      { "not groomed": [], backlog: [], todo: [], "in progress": [], done: [] },
    );
  }, [sortedTasks]);

  const visibleTaskIds = new Set(sortedTasks.map((task) => task.id));
  const selectedVisibleCount = selectedTaskIds.filter((id) => visibleTaskIds.has(id)).length;

  // Use real stats from API when available, fallback to local computation
  const overview = useMemo(() => {
    const total = taskStats?.total ?? tasks.length;
    const done =
      Number(taskStats?.byStatus?.find((s) => s.status === "done")?.count ?? 0) ||
      tasks.filter((t) => t.status === "done").length;
    const inProgress =
      Number(taskStats?.byStatus?.find((s) => s.status === "in progress")?.count ?? 0) ||
      tasks.filter((t) => t.status === "in progress").length;
    const unassigned = taskStats?.unassignedTasks ?? tasks.filter((t) => !t.assignedTeamId).length;
    const avgLoad = teamLoadData.length
      ? teamLoadData.reduce((s, t) => s + Number(t.currentLoad), 0) / teamLoadData.length
      : 0;
    const completion = total ? (done / total) * 100 : 0;
    const avgComplexity = taskStats?.averageComplexity
      ? Number(taskStats.averageComplexity).toFixed(1)
      : "—";
    return { total, done, inProgress, unassigned, avgLoad, completion, avgComplexity };
  }, [taskStats, tasks, teamLoadData]);

  const byTag = useMemo(() => {
    return tagOptions.map((tag) => ({
      tag,
      value: Number(taskStats?.byTag?.find((b) => b.tag === tag)?.count ?? 0),
    }));
  }, [taskStats]);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 border-b border-border-soft/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-primary/45 shadow-sm">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-warm-muted">
                TeamBalancer
              </p>
              <h1 className="text-lg font-semibold md:text-xl">Управление задачами команды</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {currentUser && (
              <div className="mr-1 hidden rounded-xl border border-border-soft/70 bg-surface px-3 py-1.5 text-right md:block">
                <p className="text-xs font-medium leading-4">{currentUser.username}</p>
                <p className="text-[11px] leading-4 text-warm-muted">{currentUser.email}</p>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={reloadData} disabled={isLoading}>
              {isLoading ? "Загрузка…" : "Обновить"}
            </Button>
            <Button variant="secondary" size="sm" onClick={runOptimization} disabled={isLoading}>
              Оптимизировать
            </Button>
            <Button variant="destructive" size="sm" onClick={handleLogout}>
              Выйти
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl space-y-5 px-4 pb-28 pt-6 md:px-8">
        {error ? (
          <Card className="border-accent-danger/40 bg-accent-danger/20 p-3 text-sm">{error}</Card>
        ) : null}

        {/* ══════════════════════════════════════════════════════
            TAB: ОБЗОР
        ══════════════════════════════════════════════════════ */}
        {activeTab === "Обзор" && (
          <section className="space-y-4">
            <AnalyticsPanel
              dashboard={dashboardAnalytics}
              loadChart={loadChart}
              distribution={taskDistribution}
              projectFilterLabel={
                taskProjectFilter !== "__all__"
                  ? projects.find((p) => String(p.id) === taskProjectFilter)?.name
                  : undefined
              }
            />

            {/* KPI cards */}
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              {[
                ["Всего задач", String(overview.total)],
                ["Не распределено", String(overview.unassigned)],
                ["В работе", String(overview.inProgress)],
                ["Завершено", String(overview.done)],
                ["Средняя загрузка", `${overview.avgLoad.toFixed(1)} SP`],
                ["Средняя сложность", overview.avgComplexity],
              ].map(([label, value]) => (
                <Card key={label}>
                  <CardHeader className="pb-2">
                    <CardDescription>{label}</CardDescription>
                    <CardTitle className="text-2xl">{value}</CardTitle>
                  </CardHeader>
                </Card>
              ))}
            </div>

            {/* Progress + tags */}
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Прогресс задач</CardTitle>
                  <CardDescription>Выполнение текущего пула</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-warm-muted">Завершено</span>
                      <span>{Math.round(overview.completion)}%</span>
                    </div>
                    <Progress value={overview.completion} />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {statusOptions.map((status) => {
                      const count = groupedByStatus[status].length;
                      const percent = overview.total ? (count / overview.total) * 100 : 0;
                      return (
                        <div key={status} className="rounded-xl bg-background p-3">
                          <div className="mb-1 flex items-center justify-between text-xs text-warm-muted">
                            <span>{statusLabels[status]}</span>
                            <span>{count}</span>
                          </div>
                          <Progress value={percent} />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>По тегам</CardTitle>
                  <CardDescription>Распределение задач</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {byTag.map((item) => {
                    const percent = overview.total ? (item.value / overview.total) * 100 : 0;
                    return (
                      <div key={item.tag}>
                        <div className="mb-1 flex justify-between text-xs text-warm-muted">
                          <span>{item.tag}</span>
                          <span>{item.value}</span>
                        </div>
                        <Progress value={percent} />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>

            {/* Team load from GET /teams/load */}
            <Card>
              <CardHeader>
                <CardTitle>Загрузка команд</CardTitle>
                <CardDescription>
                  Данные из /teams/load — текущая загрузка и свободная ёмкость
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  {teamLoadData.map((team) => {
                    const pct = Math.min(100, Number(team.loadPercentage));
                    const isOver = pct >= 90;
                    return (
                      <div
                        key={team.id}
                        className={cn(
                          "rounded-xl p-3",
                          isOver ? "bg-accent-danger/20" : "bg-background",
                        )}
                      >
                        <p className="truncate text-sm font-medium">{team.name}</p>
                        <p className="text-xs text-warm-muted">
                          {team.currentLoad}/{team.capacity} SP · свободно {team.available} SP
                        </p>
                        <Progress className="mt-2" value={pct} />
                        <p className="mt-1 text-xs text-warm-muted">{pct.toFixed(1)}%</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Upcoming deadlines from statistics */}
            {taskStats?.upcomingDeadlines && taskStats.upcomingDeadlines.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Ближайшие дедлайны</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {taskStats.upcomingDeadlines.slice(0, 5).map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between rounded-xl bg-background px-3 py-2 text-sm"
                      >
                        <span className="font-medium">{task.name}</span>
                        <span className="text-xs text-warm-muted">
                          {new Date(task.deadline).toLocaleDateString("ru")}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </section>
        )}

        {activeTab === "Проекты" && (
          <ProjectsPanel
            onError={setError}
            onTasksChanged={reloadData}
            statusLabels={statusLabels}
          />
        )}

        {/* ══════════════════════════════════════════════════════
            TAB: ЗАДАЧИ
        ══════════════════════════════════════════════════════ */}
        {activeTab === "Задачи" && (
          <section className="space-y-3">
            {/* ── Single compact toolbar ── */}
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border-soft bg-surface px-4 py-3">
              <Select
                value={taskProjectFilter}
                onValueChange={(v) => {
                  setTaskProjectFilter(v);
                  if (v !== "__all__") setCreateTaskProjectId(v);
                }}
              >
                <SelectTrigger className="h-8 w-44 text-xs">
                  <SelectValue placeholder="Проект" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Все проекты</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Tag */}
              <Select
                value={taskFilters.tag ?? "__all__"}
                onValueChange={(v) =>
                  setTaskFilters((p) => ({ ...p, tag: v === "__all__" ? undefined : v, page: 1 }))
                }
              >
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue placeholder="Тег" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Все теги</SelectItem>
                  {tagOptions.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Priority range */}
              <div className="flex items-center gap-1">
                <span className="text-xs text-warm-muted">P</span>
                <Input
                  type="number" min={1} max={10}
                  className="h-8 w-14 text-xs"
                  placeholder="от"
                  value={taskFilters.priority_min ?? ""}
                  onChange={(e) =>
                    setTaskFilters((p) => ({
                      ...p,
                      priority_min: e.target.value ? Number(e.target.value) : undefined,
                      page: 1,
                    }))
                  }
                />
                <span className="text-xs text-warm-muted">–</span>
                <Input
                  type="number" min={1} max={10}
                  className="h-8 w-14 text-xs"
                  placeholder="до"
                  value={taskFilters.priority_max ?? ""}
                  onChange={(e) =>
                    setTaskFilters((p) => ({
                      ...p,
                      priority_max: e.target.value ? Number(e.target.value) : undefined,
                      page: 1,
                    }))
                  }
                />
              </div>

              {/* Sort */}
              <Select
                value={taskFilters.sort_by ?? "business_priority"}
                onValueChange={(v) =>
                  setTaskFilters((p) => ({ ...p, sort_by: v as TaskFilters["sort_by"], page: 1 }))
                }
              >
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sortFields.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() =>
                  setTaskFilters((p) => ({
                    ...p,
                    sort_order: p.sort_order === "ASC" ? "DESC" : "ASC",
                    page: 1,
                  }))
                }
              >
                {taskFilters.sort_order === "ASC" ? "↑" : "↓"}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-warm-muted"
                onClick={() =>
                  setTaskFilters({ sort_by: "business_priority", sort_order: "DESC", page: 1, limit: 50 })
                }
              >
                Сбросить
              </Button>

              {/* Spacer */}
              <div className="flex-1" />

              {/* View toggle */}
              <Tabs
                value={taskView}
                onValueChange={(v) => {
                  const view = v as "kanban" | "table";
                  setTaskView(view);
                  if (view === "kanban") {
                    setTaskFilters((p) => ({ ...p, status: undefined, page: 1 }));
                  }
                }}
              >
                <TabsList className="h-8">
                  <TabsTrigger value="kanban" className="h-7 text-xs">Канбан</TabsTrigger>
                  <TabsTrigger value="table" className="h-7 text-xs">Таблица</TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Add task button */}
              <Button size="sm" className="h-8 text-xs" onClick={() => setShowAddTask(true)}>
                + Задача
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={exportTasksCsv}>
                Экспорт CSV
              </Button>
            </div>

            {taskView === "table" && (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border-soft bg-surface px-4 py-3">
                <p className="text-xs text-warm-muted">Выбрано задач: {selectedVisibleCount}</p>
                <Select
                  value={bulkStatus || "__keep__"}
                  onValueChange={(v) => setBulkStatus(v === "__keep__" ? "" : (v as TaskStatus))}
                >
                  <SelectTrigger className="h-8 w-44 text-xs">
                    <SelectValue placeholder="Статус (не менять)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__keep__">Статус: не менять</SelectItem>
                    {statusOptions.map((s) => (
                      <SelectItem key={s} value={s}>
                        {statusLabels[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={bulkAssignedTeamId} onValueChange={setBulkAssignedTeamId}>
                  <SelectTrigger className="h-8 w-52 text-xs">
                    <SelectValue placeholder="Команда (не менять)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__keep__">Команда: не менять</SelectItem>
                    <SelectItem value="__none__">Снять назначение</SelectItem>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={String(team.id)}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  className="h-8 w-36 text-xs"
                  placeholder="Приоритет 1-10"
                  value={bulkPriority}
                  onChange={(e) => setBulkPriority(e.target.value)}
                />
                <Button size="sm" className="h-8 text-xs" onClick={applyBulkUpdate}>
                  Применить к выбранным
                </Button>
              </div>
            )}

            {/* ── Kanban / Table ── */}
            <Tabs value={taskView} onValueChange={(v) => setTaskView(v as "kanban" | "table")}>
              <TabsContent value="kanban">
                <div className="grid gap-4 lg:grid-cols-5">
                  {statusOptions.map((status) => (
                    <Card
                      key={status}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={async () => {
                        if (dragTaskId) {
                          await updateTaskStatus(dragTaskId, status);
                          setDragTaskId(null);
                        }
                      }}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">{statusLabels[status]}</CardTitle>
                          <Badge variant="secondary">{groupedByStatus[status].length}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {groupedByStatus[status].map((task) => (
                          <div
                            key={task.id}
                            draggable
                            onDragStart={() => setDragTaskId(task.id)}
                            onClick={() => openTaskModal(task)}
                            className="cursor-grab rounded-xl border border-border-soft bg-white p-3 shadow-sm active:cursor-grabbing"
                          >
                            <p className="text-sm font-medium">{task.name}</p>
                            <p className="mt-1 line-clamp-2 text-xs text-warm-muted">
                              {task.description}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1">
                              <Badge variant="outline">{task.tag}</Badge>
                              <Badge variant="outline">P{task.business_priority}</Badge>
                              <Badge variant="outline">C{task.complexity}</Badge>
                            </div>
                            {task.assignedTeam && (
                              <p className="mt-1 text-xs text-warm-muted">
                                ↳ {task.assignedTeam.name}
                              </p>
                            )}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="table">
                {/* Status filter — only for table view */}
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xs text-warm-muted">Статус:</span>
                  <Select
                    value={taskFilters.status ?? "__all__"}
                    onValueChange={(v) =>
                      setTaskFilters((p) => ({
                        ...p,
                        status: v === "__all__" ? undefined : v,
                        page: 1,
                      }))
                    }
                  >
                    <SelectTrigger className="w-44">
                      <SelectValue placeholder="Все" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Все статусы</SelectItem>
                      {statusOptions.map((s) => (
                        <SelectItem key={s} value={s}>
                          {statusLabels[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-accent-primary/10">
                          <TableRow>
                            <TableHead className="w-12">
                              <input
                                type="checkbox"
                                checked={
                                  sortedTasks.length > 0 && selectedVisibleCount === sortedTasks.length
                                }
                                onChange={(e) => toggleSelectAllVisibleTasks(e.target.checked)}
                              />
                            </TableHead>
                            <TableHead>Задача</TableHead>
                            <TableHead>Тег</TableHead>
                            <TableHead>Статус</TableHead>
                            <TableHead>Приоритет</TableHead>
                            <TableHead>Сложность</TableHead>
                            <TableHead>Команда</TableHead>
                            <TableHead>Дедлайн</TableHead>
                            <TableHead>Действия</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedTasks.map((task) => (
                            <TableRow key={task.id}>
                              <TableCell>
                                <input
                                  type="checkbox"
                                  checked={selectedTaskIds.includes(task.id)}
                                  onChange={(e) => toggleTaskSelection(task.id, e.target.checked)}
                                />
                              </TableCell>
                              <TableCell>
                                <p className="font-medium">{task.name}</p>
                                <p className="text-xs text-warm-muted">{task.description}</p>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{task.tag}</Badge>
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={task.status}
                                  onValueChange={(v) =>
                                    updateTaskStatus(task.id, v as TaskStatus)
                                  }
                                >
                                  <SelectTrigger className="w-[160px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {statusOptions.map((s) => (
                                      <SelectItem key={s} value={s}>
                                        {statusLabels[s]}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>{task.business_priority}</TableCell>
                              <TableCell>{task.complexity}</TableCell>
                              <TableCell className="text-xs text-warm-muted">
                                {task.assignedTeam?.name ?? "—"}
                              </TableCell>
                              <TableCell className="text-xs text-warm-muted">
                                {task.deadline
                                  ? new Date(task.deadline).toLocaleDateString("ru")
                                  : "—"}
                              </TableCell>
                              <TableCell className="space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openTaskModal(task)}
                                >
                                  Открыть
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => deleteTask(task.id)}
                                >
                                  Удалить
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* ── Pagination ── */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={taskFilters.page === 1}
                  onClick={() => setTaskFilters((p) => ({ ...p, page: (p.page ?? 1) - 1 }))}
                >
                  ← Назад
                </Button>
                <span className="text-sm text-warm-muted">
                  Страница {taskFilters.page} из {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={taskFilters.page === totalPages}
                  onClick={() => setTaskFilters((p) => ({ ...p, page: (p.page ?? 1) + 1 }))}
                >
                  Вперёд →
                </Button>
              </div>
            )}
          </section>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB: КОМАНДЫ
        ══════════════════════════════════════════════════════ */}
        {activeTab === "Команды" && (
          <section className="space-y-3">
            {/* ── Compact toolbar ── */}
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border-soft bg-surface px-4 py-3">
              <Input
                className="h-8 w-48 text-xs"
                placeholder="Поиск по названию…"
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
              />
              <Select
                value={teamTagFilter || "__all__"}
                onValueChange={(v) => setTeamTagFilter(v === "__all__" ? "" : v)}
              >
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue placeholder="Специализация" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Все теги</SelectItem>
                  {tagOptions.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-warm-muted"
                onClick={() => { setTeamSearch(""); setTeamTagFilter(""); }}
              >
                Сбросить
              </Button>
              <div className="flex-1" />
              <Button size="sm" className="h-8 text-xs" onClick={() => setShowAddTeam(true)}>
                + Команда
              </Button>
            </div>

            {/* ── Team cards ── */}
            <div className="grid gap-3 md:grid-cols-2">
              {teams.map((team) => {
                const loadPercent = Math.min(
                  100,
                  team.capacity ? (Number(team.currentLoad) / Number(team.capacity)) * 100 : 0,
                );
                return (
                  <Card key={team.id}>
                    <CardContent className="pt-5">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold">{team.name}</h3>
                          <div className="mt-1 flex gap-2">
                            <Badge variant="outline">{team.tag}</Badge>
                            {team.isOverloaded && (
                              <Badge className="bg-accent-danger/40 text-foreground">
                                Перегружена
                              </Badge>
                            )}
                            {team.isUnderloaded && (
                              <Badge className="bg-accent-primary/40 text-foreground">
                                Недогружена
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => openTeamModal(team)}>
                            Изменить
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteTeam(team.id)}
                          >
                            Удалить
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-warm-muted">
                        <div>
                          <p className="font-medium text-foreground">
                            {team.currentLoad}/{team.capacity} SP
                          </p>
                          <p>Загрузка</p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {team.availableCapacity ?? team.capacity - team.currentLoad} SP
                          </p>
                          <p>Свободно</p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{team.tasksCount ?? "—"}</p>
                          <p>Задач</p>
                        </div>
                      </div>
                      <Progress className="mt-3" value={loadPercent} />
                      <p className="mt-1 text-xs text-warm-muted">
                        {loadPercent.toFixed(1)}% · {team.cost.toLocaleString("ru")} ₽/SP
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB: ОПТИМИЗАЦИЯ
        ══════════════════════════════════════════════════════ */}
        {activeTab === "Оптимизация" && (
          <section className="space-y-4">
            <PreferencesPanel teams={teams} onError={setError} />

            {!optimizationData ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
                  <Sparkles className="h-10 w-10 text-warm-muted" />
                  <p className="text-warm-muted">
                    Нажмите «Оптимизировать» в шапке, чтобы запустить алгоритм распределения.
                  </p>
                  <Button onClick={runOptimization} disabled={isLoading}>
                    Запустить оптимизацию
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Выберите одно из решений</CardTitle>
                    <CardDescription>
                      Доступно решений: {optimizationData.summary?.solutionsCount}. Выбор и применение
                      выполняются вручную.
                    </CardDescription>
                  </CardHeader>
                </Card>

                <div className="grid gap-3 md:grid-cols-2">
                  {optimizationData.paretoFront?.map((item) => (
                    <Card key={item.point}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">
                          {item.point}. {item.name}
                        </CardTitle>
                        <CardDescription>
                          Стоимость: {item.metrics.totalCost} · Загрузка: {item.metrics.maxLoad}%
                          {item.metrics.totalPreference != null
                            ? ` · Предпочтение: ${item.metrics.totalPreference}`
                            : ""}
                          {item.weights
                            ? ` · α=${item.weights.alpha} β=${item.weights.beta} γ=${item.weights.gamma}`
                            : ""}
                        </CardDescription>
                        <div className="pt-2">
                          <Button
                            size="sm"
                            variant={selectedOptimizationPoint === item.point ? "secondary" : "default"}
                            onClick={() => applySelectedOptimization(item.point)}
                            disabled={isLoading}
                          >
                            {selectedOptimizationPoint === item.point ? "Применено" : "Выбрать и применить"}
                          </Button>
                        </div>
                      </CardHeader>
                      {item.assignments && item.assignments.length > 0 && (
                        <CardContent>
                          <p className="mb-2 text-xs font-medium text-warm-muted uppercase tracking-wide">
                            Назначения
                          </p>
                          <div className="space-y-1">
                            {item.assignments.map((a, i) => (
                              <div key={i} className="flex justify-between text-xs">
                                <span>{a.taskName}</span>
                                <span className="text-warm-muted">→ {a.teamName}</span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      )}
                      {item.teamLoads && item.teamLoads.length > 0 && (
                        <CardContent className="pt-0">
                          <p className="mb-2 text-xs font-medium text-warm-muted uppercase tracking-wide">
                            Загрузка команд
                          </p>
                          <div className="space-y-2">
                            {item.teamLoads.map((tl) => (
                              <div key={tl.teamName}>
                                <div className="mb-1 flex justify-between text-xs text-warm-muted">
                                  <span>{tl.teamName}</span>
                                  <span>
                                    {tl.load}/{tl.capacity} SP · {tl.percentage}%
                                  </span>
                                </div>
                                <Progress value={Math.min(100, Number(tl.percentage))} />
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              </>
            )}
          </section>
        )}
      </main>

      {/* ── Bottom tab bar ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border-soft/70 bg-surface/95 px-2 py-2 backdrop-blur">
        <div className="mx-auto flex max-w-3xl justify-between gap-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex min-w-[56px] flex-1 flex-col items-center rounded-xl px-1 py-2 text-[10px] sm:text-xs",
                activeTab === tab ? "bg-accent-primary/30 font-semibold" : "text-warm-muted",
              )}
            >
              <span className="mb-0.5">{tabIcons[tab]}</span>
              {tab}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Task modal ── */}
      {selectedTask && taskDraft ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setSelectedTask(null);
              setTaskDraft(null);
            }
          }}
        >
          <DialogContent className="max-h-[88vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Карточка задачи #{selectedTask.id}</DialogTitle>
              <DialogDescription>
                {selectedTask.assignedTeam
                  ? `Назначена: ${selectedTask.assignedTeam.name}`
                  : "Команда не назначена"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={saveTaskDraft}>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm text-warm-muted md:col-span-2">
                  Название
                  <Input
                    className="mt-1"
                    value={taskDraft.name ?? ""}
                    onChange={(e) => setTaskDraft((p) => ({ ...p, name: e.target.value }))}
                  />
                </label>
                <label className="text-sm text-warm-muted md:col-span-2">
                  Описание
                  <Textarea
                    className="mt-1 min-h-[110px]"
                    value={taskDraft.description ?? ""}
                    onChange={(e) => setTaskDraft((p) => ({ ...p, description: e.target.value }))}
                  />
                </label>
                <label className="text-sm text-warm-muted">
                  Тег
                  <select
                    className="mt-1 h-10 w-full rounded-xl border border-border-soft bg-white px-3 text-sm"
                    value={taskDraft.tag ?? "frontend"}
                    onChange={(e) =>
                      setTaskDraft((p) => ({ ...p, tag: e.target.value as TagType }))
                    }
                  >
                    {tagOptions.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-warm-muted">
                  Статус
                  <Select
                    value={(taskDraft.status ?? "backlog") as string}
                    onValueChange={(v) =>
                      setTaskDraft((p) => ({ ...p, status: v as TaskStatus }))
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((s) => (
                        <SelectItem key={s} value={s}>
                          {statusLabels[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="text-sm text-warm-muted">
                  Команда
                  <Select
                    value={String(taskDraft.assignedTeamId ?? "__none__")}
                    onValueChange={(v) =>
                      setTaskDraft((p) => ({
                        ...p,
                        assignedTeamId: v === "__none__" ? null : Number(v),
                      }))
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Не назначена" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Не назначена</SelectItem>
                      {teams.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="text-sm text-warm-muted">
                  Сложность (1–10)
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    className="mt-1"
                    value={taskDraft.complexity ?? 5}
                    onChange={(e) =>
                      setTaskDraft((p) => ({ ...p, complexity: Number(e.target.value) }))
                    }
                  />
                </label>
                <label className="text-sm text-warm-muted">
                  Приоритет (1–3)
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    className="mt-1"
                    value={taskDraft.business_priority ?? 5}
                    onChange={(e) =>
                      setTaskDraft((p) => ({
                        ...p,
                        business_priority: Number(e.target.value),
                      }))
                    }
                  />
                </label>
                <label className="text-sm text-warm-muted md:col-span-2">
                  Дедлайн
                  <Input
                    type="datetime-local"
                    className="mt-1"
                    value={String(taskDraft.deadline ?? "").slice(0, 16)}
                    onChange={(e) => setTaskDraft((p) => ({ ...p, deadline: e.target.value }))}
                  />
                </label>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => selectedTask && deleteTask(selectedTask.id)}
                >
                  Удалить
                </Button>
                <Button type="submit">Сохранить</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}

      {/* ── Add task modal ── */}
      <Dialog open={showAddTask} onOpenChange={setShowAddTask}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Новая задача</DialogTitle>
            <DialogDescription>
              Задача создаётся в проекте (POST /projects/:id/tasks)
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createTask}>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm text-warm-muted md:col-span-2">
                Проект
                <Select value={createTaskProjectId} onValueChange={setCreateTaskProjectId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Выберите проект" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="text-sm text-warm-muted md:col-span-2">
                Название
                <Input
                  className="mt-1"
                  placeholder="Разработать главную страницу"
                  value={taskForm.name}
                  onChange={(e) => setTaskForm((p) => ({ ...p, name: e.target.value }))}
                  required
                />
              </label>
              <label className="text-sm text-warm-muted md:col-span-2">
                Описание
                <Textarea
                  className="mt-1 min-h-[80px]"
                  placeholder="Подробное описание задачи"
                  value={taskForm.description}
                  onChange={(e) => setTaskForm((p) => ({ ...p, description: e.target.value }))}
                  required
                />
              </label>
              <label className="text-sm text-warm-muted">
                Тег
                <select
                  className="mt-1 h-10 w-full rounded-xl border border-border-soft bg-white px-3 text-sm"
                  value={taskForm.tag}
                  onChange={(e) => setTaskForm((p) => ({ ...p, tag: e.target.value as TagType }))}
                >
                  {tagOptions.map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
              <label className="text-sm text-warm-muted">
                Статус
                <Select
                  value={taskForm.status}
                  onValueChange={(v) => setTaskForm((p) => ({ ...p, status: v as TaskStatus }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((s) => (
                      <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="text-sm text-warm-muted">
                Сложность (1–10)
                <Input
                  type="number" min={1} max={10} className="mt-1"
                  value={taskForm.complexity}
                  onChange={(e) => setTaskForm((p) => ({ ...p, complexity: Number(e.target.value) }))}
                />
              </label>
              <label className="text-sm text-warm-muted">
                Приоритет (1–3)
                <Input
                  type="number" min={1} max={10} className="mt-1"
                  value={taskForm.business_priority}
                  onChange={(e) => setTaskForm((p) => ({ ...p, business_priority: Number(e.target.value) }))}
                />
              </label>
              <label className="text-sm text-warm-muted md:col-span-2">
                Дедлайн
                <Input
                  type="datetime-local" className="mt-1"
                  value={taskForm.deadline}
                  onChange={(e) => setTaskForm((p) => ({ ...p, deadline: e.target.value }))}
                  required
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowAddTask(false)}>
                Отмена
              </Button>
              <Button type="submit">Создать</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Add team modal ── */}
      <Dialog open={showAddTeam} onOpenChange={setShowAddTeam}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Новая команда</DialogTitle>
            <DialogDescription>Заполните поля и нажмите «Создать»</DialogDescription>
          </DialogHeader>
          <form onSubmit={createTeam}>
            <div className="grid gap-3">
              <label className="text-sm text-warm-muted">
                Название
                <Input
                  className="mt-1"
                  placeholder="Frontend Разработка"
                  value={teamForm.name}
                  onChange={(e) => setTeamForm((p) => ({ ...p, name: e.target.value }))}
                  required
                />
              </label>
              <label className="text-sm text-warm-muted">
                Специализация
                <select
                  className="mt-1 h-10 w-full rounded-xl border border-border-soft bg-white px-3 text-sm"
                  value={teamForm.tag}
                  onChange={(e) => setTeamForm((p) => ({ ...p, tag: e.target.value as TagType }))}
                >
                  {tagOptions.map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm text-warm-muted">
                  Ёмкость (SP)
                  <Input
                    type="number" min={1} className="mt-1"
                    placeholder="40"
                    value={teamForm.capacity}
                    onChange={(e) => setTeamForm((p) => ({ ...p, capacity: Number(e.target.value) }))}
                  />
                </label>
                <label className="text-sm text-warm-muted">
                  Стоимость (₽/SP)
                  <Input
                    type="number" min={1} className="mt-1"
                    placeholder="2000"
                    value={teamForm.cost}
                    onChange={(e) => setTeamForm((p) => ({ ...p, cost: Number(e.target.value) }))}
                  />
                </label>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowAddTeam(false)}>
                Отмена
              </Button>
              <Button type="submit">Создать</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Team edit modal ── */}
      {selectedTeam && teamDraft ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setSelectedTeam(null);
              setTeamDraft(null);
              setSelectedTeamTasks(null);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Редактировать команду</DialogTitle>
              <DialogDescription>{selectedTeam.name}</DialogDescription>
            </DialogHeader>
            <form onSubmit={saveTeamDraft}>
              <div className="grid gap-3">
                <label className="text-sm text-warm-muted">
                  Название
                  <Input
                    className="mt-1"
                    value={teamDraft.name ?? ""}
                    onChange={(e) => setTeamDraft((p) => ({ ...p, name: e.target.value }))}
                    required
                  />
                </label>
                <label className="text-sm text-warm-muted">
                  Специализация
                  <select
                    className="mt-1 h-10 w-full rounded-xl border border-border-soft bg-white px-3 text-sm"
                    value={teamDraft.tag ?? "frontend"}
                    onChange={(e) =>
                      setTeamDraft((p) => ({ ...p, tag: e.target.value as TagType }))
                    }
                  >
                    {tagOptions.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-warm-muted">
                  Ёмкость (SP)
                  <Input
                    type="number"
                    min={1}
                    className="mt-1"
                    value={teamDraft.capacity ?? 40}
                    onChange={(e) =>
                      setTeamDraft((p) => ({ ...p, capacity: Number(e.target.value) }))
                    }
                  />
                </label>
                <label className="text-sm text-warm-muted">
                  Стоимость (₽/SP)
                  <Input
                    type="number"
                    min={1}
                    className="mt-1"
                    value={teamDraft.cost ?? 2000}
                    onChange={(e) =>
                      setTeamDraft((p) => ({ ...p, cost: Number(e.target.value) }))
                    }
                  />
                </label>
              </div>
              <div className="mt-4 rounded-xl border border-border-soft bg-surface p-3">
                <p className="text-sm font-medium">Задачи команды</p>
                {isTeamTasksLoading ? (
                  <p className="mt-2 text-xs text-warm-muted">Загрузка...</p>
                ) : selectedTeamTasks ? (
                  <>
                    <p className="mt-2 text-xs text-warm-muted">
                      Всего: {selectedTeamTasks.stats?.total ?? selectedTeamTasks.tasks.length} · Ср.
                      приоритет: {selectedTeamTasks.stats?.avgPriority ?? "—"}
                    </p>
                    <div className="mt-2 space-y-1">
                      {selectedTeamTasks.tasks.slice(0, 5).map((task) => (
                        <div key={task.id} className="rounded-lg bg-background px-2 py-1 text-xs">
                          {task.name}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-xs text-warm-muted">Нет данных по задачам</p>
                )}
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSelectedTeam(null);
                    setTeamDraft(null);
                  }}
                >
                  Отмена
                </Button>
                <Button type="submit">Сохранить</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
