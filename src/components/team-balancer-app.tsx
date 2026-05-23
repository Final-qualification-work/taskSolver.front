"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  FolderKanban,
  KanbanSquare,
  LayoutDashboard,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
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
import { ProjectsPanel } from "@/components/projects-panel";
import { UsersAdminPanel } from "@/components/users-admin-panel";
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
import { getCapabilities, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/permissions";

type AppTab = "Обзор" | "Проекты" | "Задачи" | "Команды" | "Оптимизация" | "Админ";
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
const tabIcons: Record<AppTab, React.ReactNode> = {
  Обзор: <LayoutDashboard className="h-4 w-4" />,
  Проекты: <FolderKanban className="h-4 w-4" />,
  Задачи: <KanbanSquare className="h-4 w-4" />,
  Команды: <Users className="h-4 w-4" />,
  Оптимизация: <Sparkles className="h-4 w-4" />,
  Админ: <Shield className="h-4 w-4" />,
};

type OptimizeViewData = {
  summary?: {
    solutionsCount?: number;
    totalTeams?: number;
    totalTasks?: number;
  };
  paretoFront?: OptimizationSolution[];
};

const OPTIMIZATION_POINT_ORDER = ["A", "C", "D", "F"] as const;
const OPTIMIZATION_VARIANT_NAMES = new Set([
  "Минимизация стоимости",
  "Равный баланс",
  "Акцент на разгрузке",
  "Максимум приоритета",
  "Максимум предпочтительности",
]);
const POINT_BY_VARIANT_NAME: Record<string, (typeof OPTIMIZATION_POINT_ORDER)[number]> = {
  "Минимизация стоимости": "A",
  "Равный баланс": "C",
  "Акцент на разгрузке": "D",
  "Максимум приоритета": "F",
  "Максимум предпочтительности": "F",
};

function filterOptimizationVariants(items: OptimizationSolution[] | undefined) {
  if (!items?.length) return [];
  return [...items]
    .filter(
      (item) =>
        OPTIMIZATION_VARIANT_NAMES.has(item.name) ||
        OPTIMIZATION_POINT_ORDER.includes(item.point as (typeof OPTIMIZATION_POINT_ORDER)[number]),
    )
    .map((item) => ({
      ...item,
      point:
        OPTIMIZATION_POINT_ORDER.includes(item.point as (typeof OPTIMIZATION_POINT_ORDER)[number])
          ? item.point
          : (POINT_BY_VARIANT_NAME[item.name] ?? item.point),
    }))
    .sort(
      (a, b) =>
        OPTIMIZATION_POINT_ORDER.indexOf(a.point as (typeof OPTIMIZATION_POINT_ORDER)[number]) -
        OPTIMIZATION_POINT_ORDER.indexOf(b.point as (typeof OPTIMIZATION_POINT_ORDER)[number]),
    );
}

export default function TeamBalancerApp() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AppTab>("Обзор");
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

  const caps = useMemo(() => getCapabilities(currentUser), [currentUser]);
  const readOnly = !caps.canEditTasks;
  const userCanOptimize = caps.canOptimize;
  const visibleTabs = useMemo((): AppTab[] => {
    const base: AppTab[] = ["Обзор", "Проекты", "Задачи", "Команды"];
    const result = [...base];
    if (userCanOptimize) result.push("Оптимизация");
    if (caps.canManageUsers) result.push("Админ");
    return result;
  }, [userCanOptimize, caps.canManageUsers]);

  const displayedTab: AppTab =
    activeTab === "Оптимизация" && !userCanOptimize
      ? "Обзор"
      : activeTab === "Админ" && !caps.canManageUsers
        ? "Обзор"
        : activeTab;

  function selectTab(tab: AppTab) {
    if (tab === "Оптимизация" && !userCanOptimize) return;
    if (tab === "Админ" && !caps.canManageUsers) return;
    setActiveTab(tab);
  }

  const [myTasksOnly, setMyTasksOnly] = useState(false);

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

  const [teamSearch, setTeamSearch] = useState("");
  const [teamTagFilter, setTeamTagFilter] = useState("");

  const [fetchTick, setFetchTick] = useState(0);
  function reloadData() {
    setFetchTick((t) => t + 1);
  }

  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [taskDraft, setTaskDraft] = useState<Partial<TaskItem> | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamDraft, setTeamDraft] = useState<Partial<Team> | null>(null);
  const [selectedTeamTasks, setSelectedTeamTasks] = useState<TeamTasksData | null>(null);
  const [isTeamTasksLoading, setIsTeamTasksLoading] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddTeam, setShowAddTeam] = useState(false);

  const [taskForm, setTaskForm] = useState({
    name: "",
    description: "",
    tag: "frontend" as TagType,
    complexity: 5,
    deadline: "",
    business_priority: 2,
    status: "backlog" as TaskStatus,
    assignedTeamId: null as number | null,
  });
  const [teamForm, setTeamForm] = useState({
    name: "",
    tag: "frontend" as TagType,
    cost: 2000,
    capacity: 40,
  });

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
          api.getProjects(),
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
    if (displayedTab !== "Обзор") return;
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
  }, [displayedTab, taskProjectFilter, fetchTick]);

  async function createTask(e: FormEvent) {
    e.preventDefault();
    if (readOnly || !caps.canCreateTasks) return;
    if (!createTaskProjectId) {
      setError("Выберите проект — задачи создаются внутри проекта");
      return;
    }
    try {
      await api.addTaskToProject(Number(createTaskProjectId), {
        ...taskForm,
        deadline: taskForm.deadline || new Date().toISOString(),
        assignedTeamId: taskForm.assignedTeamId ?? undefined,
      });
      setTaskForm({
        name: "",
        description: "",
        tag: "frontend",
        complexity: 5,
        deadline: "",
        business_priority: 2,
        status: "backlog",
        assignedTeamId: null,
      });
      setShowAddTask(false);
      reloadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать задачу");
    }
  }

  async function updateTaskStatus(taskId: number, status: TaskStatus) {
    if (readOnly) return;
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
    if (readOnly) return;
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
    if (readOnly) return;
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
    if (readOnly || !selectedTask || !taskDraft) return;
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

  async function createTeam(e: FormEvent) {
    e.preventDefault();
    if (!caps.canManageTeams) return;
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
    if (!caps.canManageTeams) return;
    try {
      await api.deleteTeam(teamId);
      reloadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось удалить команду");
    }
  }

  async function saveTeamDraft(e: FormEvent) {
    e.preventDefault();
    if (!caps.canManageTeams) return;
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

  async function exportTasksCsv() {
    if (!caps.canViewReports) {
      setError("Недостаточно прав для экспорта отчётов");
      return;
    }
    try {
      await api.exportTasksCsv({
        status: taskFilters.status,
        tag: taskFilters.tag,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось экспортировать задачи");
    }
  }

  async function runOptimization() {
    if (!userCanOptimize) {
      setError("Недостаточно прав для запуска оптимизации");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const result = await api.optimize();
      setOptimizationData(result.data || null);
      selectTab("Оптимизация");
      setSelectedOptimizationPoint("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось выполнить оптимизацию");
    } finally {
      setIsLoading(false);
    }
  }

  async function applySelectedOptimization(point: string) {
    if (!userCanOptimize) {
      setError("Недостаточно прав для применения оптимизации");
      return;
    }
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

  const myTeamLoad = useMemo(() => {
    if (!currentUser?.teamId) return null;
    const fromLoad = teamLoadData.find((t) => t.id === currentUser.teamId);
    if (fromLoad) {
      return {
        name: fromLoad.name,
        currentLoad: fromLoad.currentLoad,
        capacity: fromLoad.capacity,
        pct: Math.min(100, Number(fromLoad.loadPercentage)),
      };
    }
    const team = teams.find((t) => t.id === currentUser.teamId);
    if (!team) return null;
    const pct = team.capacity ? Math.round((team.currentLoad / team.capacity) * 100) : 0;
    return {
      name: team.name,
      currentLoad: team.currentLoad,
      capacity: team.capacity,
      pct: Math.min(100, pct),
    };
  }, [currentUser, teamLoadData, teams]);

  const projectFilteredTasks = useMemo(() => {
    let list = tasks;
    if (taskProjectFilter !== "__all__") {
      const pid = Number(taskProjectFilter);
      list = list.filter((t) => t.projectId === pid);
    }
    if (myTasksOnly && currentUser?.teamId) {
      list = list.filter((t) => t.assignedTeamId === currentUser.teamId);
    }
    return list;
  }, [tasks, taskProjectFilter, myTasksOnly, currentUser]);

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

  const optimizationVariants = useMemo(
    () => filterOptimizationVariants(optimizationData?.paretoFront),
    [optimizationData],
  );

  const visibleTaskIds = new Set(sortedTasks.map((task) => task.id));
  const selectedVisibleCount = selectedTaskIds.filter((id) => visibleTaskIds.has(id)).length;

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      {}
      <header className="sticky top-0 z-30 border-b border-border-soft/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-8">
          <div className="flex items-center gap-3">

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-warm-muted">
                TeamBalancer
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {currentUser && (
              <div className="mr-1 hidden rounded-xl border border-border-soft/70 bg-surface px-3 py-1.5 text-right md:block">
                <p className="text-xs font-medium leading-4">{currentUser.username}</p>
                <p className="text-[11px] leading-4 text-warm-muted">
                  {ROLE_LABELS[currentUser.role] ?? currentUser.role}
                </p>
                <p className="text-[10px] leading-4 text-warm-muted/80">{currentUser.email}</p>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={reloadData} disabled={isLoading}>
              {isLoading ? "Загрузка…" : "Обновить"}
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

        {

}
        {displayedTab === "Обзор" && (
          <section className="space-y-4">

            {myTeamLoad ? (
              <div className="rounded-2xl bg-surface p-5 ring-1 ring-border-soft/60">
                <p className="text-sm font-semibold">Моя загрузка</p>
                <p className="mt-1 text-xs text-warm-muted">
                  Команда: {myTeamLoad.name} · {myTeamLoad.currentLoad} / {myTeamLoad.capacity} SP
                </p>
                <Progress className="mt-3 h-2" value={myTeamLoad.pct} />
                <p className="mt-2 text-sm tabular-nums font-medium">{myTeamLoad.pct}%</p>
              </div>
            ) : null}

            <AnalyticsPanel
              dashboard={dashboardAnalytics}
              loadChart={loadChart}
              distribution={taskDistribution}
              projectFilterLabel={
                taskProjectFilter !== "__all__"
                  ? projects.find((p) => String(p.id) === taskProjectFilter)?.name
                  : undefined
              }
              canAccessOptimization={userCanOptimize}
              onNavigate={(tab) => {
                if (tab === "Оптимизация" && !userCanOptimize) return;
                selectTab(tab as AppTab);
              }}
            />

            {taskStats?.upcomingDeadlines && taskStats.upcomingDeadlines.length > 0 && (
              <div className="rounded-2xl bg-surface p-5 ring-1 ring-border-soft/60">
                <p className="mb-3 font-semibold">Ближайшие дедлайны</p>
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
              </div>
            )}
          </section>
        )}

        {displayedTab === "Проекты" && (
          <ProjectsPanel
            onError={setError}
            onTasksChanged={reloadData}
            statusLabels={statusLabels}
            teams={teams}
            canManageProjects={caps.canManageProjects}
            canDeleteProjects={caps.canDeleteProjects}
            canCreateTasksInProject={caps.canCreateTasks}
            showFinancialInfo={userCanOptimize}
          />
        )}

        {displayedTab === "Админ" && caps.canManageUsers && (
          <UsersAdminPanel teams={teams} onError={setError} />
        )}

        {

}
        {displayedTab === "Задачи" && (
          <section className="space-y-3">
            {}
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

              {}
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

              {}
              <div className="flex items-center gap-1">
                <span className="text-xs text-warm-muted">P</span>
                <Input
                  type="number" min={1} max={3}
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
                  type="number" min={1} max={3}
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

              {currentUser?.teamId ? (
                <Button
                  variant={myTasksOnly ? "secondary" : "outline"}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setMyTasksOnly((v) => !v);
                    setTaskFilters((p) => ({
                      ...p,
                      page: 1,
                      assignedTeamId:
                        !myTasksOnly && currentUser.teamId ? currentUser.teamId : undefined,
                    }));
                  }}
                >
                  {myTasksOnly ? "Все задачи" : "Мои задачи"}
                </Button>
              ) : null}

              <div className="flex-1" />

              {}
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

              {caps.canCreateTasks ? (
                <Button size="sm" className="h-8 text-xs" onClick={() => setShowAddTask(true)}>
                  + Задача
                </Button>
              ) : null}
              {caps.canViewReports ? (
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={exportTasksCsv}>
                  Экспорт CSV
                </Button>
              ) : null}
            </div>

            {taskView === "table" && caps.canEditTasks && (
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
                {caps.canAssignTeams ? (
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
                ) : null}
                <Select value={bulkPriority || "__keep__"} onValueChange={(v) => setBulkPriority(v === "__keep__" ? "" : v)}>
                  <SelectTrigger className="h-8 w-40 text-xs">
                    <SelectValue placeholder="Приоритет (не менять)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__keep__">Приоритет: не менять</SelectItem>
                    <SelectItem value="1">Низкий (1)</SelectItem>
                    <SelectItem value="2">Средний (2)</SelectItem>
                    <SelectItem value="3">Высокий (3)</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" className="h-8 text-xs" onClick={applyBulkUpdate}>
                  Применить к выбранным
                </Button>
              </div>
            )}

            {}
            <Tabs value={taskView} onValueChange={(v) => setTaskView(v as "kanban" | "table")}>
              <TabsContent value="kanban">
                <div className="grid gap-4 lg:grid-cols-5">
                  {statusOptions.map((status) => (
                    <Card
                      key={status}
                      onDragOver={readOnly ? undefined : (e) => e.preventDefault()}
                      onDrop={
                        readOnly
                          ? undefined
                          : async () => {
                            if (dragTaskId) {
                              await updateTaskStatus(dragTaskId, status);
                              setDragTaskId(null);
                            }
                          }
                      }
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
                            draggable={!readOnly}
                            onDragStart={readOnly ? undefined : () => setDragTaskId(task.id)}
                            onClick={() => openTaskModal(task)}
                            className={cn(
                              "rounded-xl border border-border-soft bg-white p-3 shadow-sm",
                              readOnly ? "cursor-pointer" : "cursor-grab active:cursor-grabbing",
                            )}
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
                {}
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
                            {caps.canEditTasks ? (
                              <TableHead className="w-12">
                                <input
                                  type="checkbox"
                                  checked={
                                    sortedTasks.length > 0 &&
                                    selectedVisibleCount === sortedTasks.length
                                  }
                                  onChange={(e) => toggleSelectAllVisibleTasks(e.target.checked)}
                                />
                              </TableHead>
                            ) : null}
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
                              {caps.canEditTasks ? (
                                <TableCell>
                                  <input
                                    type="checkbox"
                                    checked={selectedTaskIds.includes(task.id)}
                                    onChange={(e) => toggleTaskSelection(task.id, e.target.checked)}
                                  />
                                </TableCell>
                              ) : null}
                              <TableCell>
                                <p className="font-medium">{task.name}</p>
                                <p className="text-xs text-warm-muted">{task.description}</p>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{task.tag}</Badge>
                              </TableCell>
                              <TableCell>
                                {readOnly ? (
                                  <Badge variant="outline">{statusLabels[task.status]}</Badge>
                                ) : (
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
                                )}
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
                                  {readOnly ? "Просмотр" : "Открыть"}
                                </Button>
                                {caps.canDeleteTasks ? (
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => deleteTask(task.id)}
                                  >
                                    Удалить
                                  </Button>
                                ) : null}
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

            {}
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

        {

}
        {displayedTab === "Команды" && (
          <section className="space-y-3">
            {}
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
              {caps.canManageTeams ? (
                <Button size="sm" className="h-8 text-xs" onClick={() => setShowAddTeam(true)}>
                  + Команда
                </Button>
              ) : null}
            </div>

            {}
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
                          {caps.canManageTeams ? (
                            <>
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
                            </>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => openTeamModal(team)}>
                              Задачи
                            </Button>
                          )}
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
                        {loadPercent.toFixed(1)}%
                        {userCanOptimize
                          ? ` · ${team.cost.toLocaleString("ru")} ₽/SP`
                          : null}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {

}
        {displayedTab === "Оптимизация" && userCanOptimize && (
          <section className="space-y-4">

            {!optimizationData ? (
              <div className="rounded-2xl bg-surface p-10 ring-1 ring-border-soft/60 text-center">
                <Sparkles className="mx-auto h-10 w-10 text-warm-muted" />
                <p className="mt-4 text-warm-muted">
                  Запустите алгоритм, чтобы получить варианты распределения задач по командам.
                </p>
                <Button className="mt-5" onClick={runOptimization} disabled={isLoading}>
                  Запустить оптимизацию
                </Button>
              </div>
            ) : (
              <>
                {}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface px-5 py-4 ring-1 ring-border-soft/60">
                  <div>
                    <p className="font-semibold">Варианты распределения</p>
                    <p className="text-xs text-warm-muted">
                      {optimizationVariants.length} варианта · кликните карточку для деталей
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={runOptimization} disabled={isLoading}>
                    Пересчитать
                  </Button>
                </div>

                {}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {optimizationVariants.map((item) => {
                    const applied = selectedOptimizationPoint === item.point;
                    const loadNum = Number(item.metrics.maxLoad);
                    const loadColor =
                      loadNum >= 85 ? "#f87171" : loadNum >= 70 ? "#fbbf24" : "#34d399";
                    return (
                      <button
                        key={item.point}
                        type="button"
                        onClick={() => setSelectedOptimizationPoint(
                          selectedOptimizationPoint === item.point ? "" : item.point
                        )}
                        className={cn(
                          "group w-full rounded-2xl bg-surface p-4 text-left ring-1 transition-all",
                          "hover:ring-accent-primary/40 hover:shadow-lg active:scale-[0.98]",
                          applied
                            ? "ring-2 ring-accent-primary/60 bg-accent-primary/5"
                            : "ring-border-soft/60",
                        )}
                      >
                        {}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-accent-primary/20 text-sm font-bold text-accent-primary">
                              {item.point}
                            </span>
                            <span className="text-sm font-semibold leading-tight">{item.name}</span>
                          </div>
                          {applied && (
                            <span className="shrink-0 rounded-full bg-accent-primary/20 px-2 py-0.5 text-[10px] font-medium text-accent-primary">
                              Применено
                            </span>
                          )}
                        </div>

                        {}
                        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                          <div className="rounded-lg bg-background px-1 py-2">
                            <p className="text-xs font-bold tabular-nums">
                              {Number(item.metrics.totalCost).toLocaleString("ru")}
                            </p>
                            <p className="text-[10px] text-warm-muted">₽ затраты</p>
                          </div>
                          <div className="rounded-lg bg-background px-1 py-2">
                            <p className="text-xs font-bold tabular-nums" style={{ color: loadColor }}>
                              {item.metrics.maxLoad}%
                            </p>
                            <p className="text-[10px] text-warm-muted">загрузка</p>
                          </div>
                          <div className="rounded-lg bg-background px-1 py-2">
                            <p className="text-xs font-bold tabular-nums">
                              {Number(item.metrics.totalPreference ?? 0).toFixed(1)}
                            </p>
                            <p className="text-[10px] text-warm-muted">Σ приор.</p>
                          </div>
                        </div>

                        {}
                        {item.weights && (
                          <p className="mt-2 text-[10px] text-warm-muted">
                            α={item.weights.alpha} β={item.weights.beta} γ={item.weights.gamma}
                          </p>
                        )}

                        <p className="mt-2 text-[10px] text-warm-muted/50 group-hover:text-warm-muted transition-colors">
                          Нажмите для деталей →
                        </p>
                      </button>
                    );
                  })}
                </div>

                {}
                {(() => {
                  const item = optimizationVariants.find(
                    (i) => i.point === selectedOptimizationPoint,
                  );
                  if (!item) return null;
                  return (
                    <div className="rounded-2xl bg-surface ring-1 ring-accent-primary/40 overflow-hidden">
                      {}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-soft/60 px-5 py-4">
                        <div>
                          <p className="font-semibold">
                            {item.point}. {item.name}
                          </p>
                          <p className="text-xs text-warm-muted">
                            Стоимость {Number(item.metrics.totalCost).toLocaleString("ru")} ₽ ·
                            Загрузка {item.metrics.maxLoad}% ·
                            Сумма приоритетов {Number(item.metrics.totalPreference ?? 0).toFixed(0)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => applySelectedOptimization(item.point)}
                            disabled={isLoading}
                          >
                            {isLoading ? "Применение…" : "Применить"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedOptimizationPoint("")}
                          >
                            Закрыть
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-6 p-5 md:grid-cols-2">
                        {}
                        {item.assignments && item.assignments.length > 0 && (
                          <div>
                            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-warm-muted">
                              Назначения задач
                            </p>
                            <div className="space-y-1.5">
                              {item.assignments.map((a, i) => (
                                <div
                                  key={i}
                                  className="flex items-center justify-between rounded-xl bg-background px-3 py-2 text-sm"
                                >
                                  <span className="truncate font-medium">{a.taskName}</span>
                                  <span className="ml-2 shrink-0 text-xs text-warm-muted">
                                    → {a.teamName}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {}
                        {item.teamLoads && item.teamLoads.length > 0 && (
                          <div>
                            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-warm-muted">
                              Загрузка команд
                            </p>
                            <div className="space-y-3">
                              {item.teamLoads.map((tl) => {
                                const pct = Math.min(100, Number(tl.percentage));
                                const c =
                                  pct >= 85 ? "#f87171" : pct >= 70 ? "#fbbf24" : "#34d399";
                                return (
                                  <div key={tl.teamName}>
                                    <div className="mb-1 flex justify-between text-xs">
                                      <span className="font-medium">{tl.teamName}</span>
                                      <span className="font-semibold tabular-nums" style={{ color: c }}>
                                        {tl.load}/{tl.capacity} SP · {pct}%
                                      </span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-background">
                                      <div
                                        className="h-full rounded-full transition-all duration-700"
                                        style={{ width: `${pct}%`, background: c }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </section>
        )}
      </main>

      {}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border-soft/70 bg-surface/95 px-2 py-2 backdrop-blur">
        <div className="mx-auto flex max-w-3xl justify-between gap-1">
          {visibleTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => selectTab(tab)}
              className={cn(
                "flex min-w-[56px] flex-1 flex-col items-center rounded-xl px-1 py-2 text-[10px] sm:text-xs",
                displayedTab === tab ? "bg-accent-primary/30 font-semibold" : "text-warm-muted",
              )}
            >
              <span className="mb-0.5">{tabIcons[tab]}</span>
              {tab}
            </button>
          ))}
        </div>
      </nav>

      {}
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
              <DialogTitle>
                {readOnly ? "Просмотр задачи" : "Карточка задачи"} #{selectedTask.id}
              </DialogTitle>
              <DialogDescription>
                {readOnly
                  ? "Режим только для просмотра"
                  : selectedTask.assignedTeam
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
                    disabled={readOnly}
                    value={taskDraft.name ?? ""}
                    onChange={(e) => setTaskDraft((p) => ({ ...p, name: e.target.value }))}
                  />
                </label>
                <label className="text-sm text-warm-muted md:col-span-2">
                  Описание
                  <Textarea
                    className="mt-1 min-h-[110px]"
                    disabled={readOnly}
                    value={taskDraft.description ?? ""}
                    onChange={(e) => setTaskDraft((p) => ({ ...p, description: e.target.value }))}
                  />
                </label>
                <label className="text-sm text-warm-muted">
                  Тег
                  <select
                    className="mt-1 h-10 w-full rounded-xl border border-border-soft bg-white px-3 text-sm disabled:opacity-60"
                    disabled={readOnly}
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
                    disabled={readOnly}
                    value={(taskDraft.status ?? "backlog") as string}
                    onValueChange={(v) =>
                      setTaskDraft((p) => ({ ...p, status: v as TaskStatus }))
                    }
                  >
                    <SelectTrigger className="mt-1" disabled={readOnly}>
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
                  Команда-исполнитель
                  <Select
                    disabled={readOnly || !caps.canAssignTeams}
                    value={String(taskDraft.assignedTeamId ?? "__none__")}
                    onValueChange={(v) =>
                      setTaskDraft((p) => ({
                        ...p,
                        assignedTeamId: v === "__none__" ? null : Number(v),
                      }))
                    }
                  >
                    <SelectTrigger className="mt-1" disabled={readOnly || !caps.canAssignTeams}>
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
                    disabled={readOnly}
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
                    max={3}
                    className="mt-1"
                    disabled={readOnly}
                    value={taskDraft.business_priority ?? 2}
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
                    disabled={readOnly}
                    value={String(taskDraft.deadline ?? "").slice(0, 16)}
                    onChange={(e) => setTaskDraft((p) => ({ ...p, deadline: e.target.value }))}
                  />
                </label>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                {readOnly ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSelectedTask(null);
                      setTaskDraft(null);
                    }}
                  >
                    Закрыть
                  </Button>
                ) : null}
                {caps.canDeleteTasks ? (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => selectedTask && deleteTask(selectedTask.id)}
                  >
                    Удалить
                  </Button>
                ) : null}
                {caps.canEditTasks ? <Button type="submit">Сохранить</Button> : null}
              </div>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}

      {}
      <Dialog open={showAddTask} onOpenChange={setShowAddTask}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Новая задача</DialogTitle>
            <DialogDescription>
              Задача будет добавлена в выбранный проект
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
                  type="number" min={1} max={3} className="mt-1"
                  value={taskForm.business_priority}
                  onChange={(e) => setTaskForm((p) => ({ ...p, business_priority: Number(e.target.value) }))}
                />
              </label>
              {caps.canAssignTeams ? (
                <label className="text-sm text-warm-muted md:col-span-2">
                  Команда-исполнитель
                  <Select
                    value={String(taskForm.assignedTeamId ?? "__none__")}
                    onValueChange={(v) =>
                      setTaskForm((p) => ({
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
              ) : null}
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

      {}
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
              <label className="text-sm text-warm-muted">
                Ёмкость (SP)
                <Input
                  type="number"
                  min={1}
                  className="mt-1"
                  placeholder="40"
                  value={teamForm.capacity}
                  onChange={(e) => setTeamForm((p) => ({ ...p, capacity: Number(e.target.value) }))}
                />
              </label>
              {userCanOptimize ? (
                <label className="text-sm text-warm-muted">
                  Стоимость (₽/SP)
                  <Input
                    type="number"
                    min={1}
                    className="mt-1"
                    placeholder="2000"
                    value={teamForm.cost}
                    onChange={(e) => setTeamForm((p) => ({ ...p, cost: Number(e.target.value) }))}
                  />
                </label>
              ) : null}
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

      {}
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
                    disabled={!caps.canManageTeams}
                    value={teamDraft.name ?? ""}
                    onChange={(e) => setTeamDraft((p) => ({ ...p, name: e.target.value }))}
                    required={caps.canManageTeams}
                  />
                </label>
                <label className="text-sm text-warm-muted">
                  Специализация
                  <select
                    className="mt-1 h-10 w-full rounded-xl border border-border-soft bg-white px-3 text-sm disabled:opacity-60"
                    disabled={!caps.canManageTeams}
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
                    disabled={!caps.canManageTeams}
                    value={teamDraft.capacity ?? 40}
                    onChange={(e) =>
                      setTeamDraft((p) => ({ ...p, capacity: Number(e.target.value) }))
                    }
                  />
                </label>
                {userCanOptimize ? (
                  <label className="text-sm text-warm-muted">
                    Стоимость (₽/SP)
                    <Input
                      type="number"
                      min={1}
                      className="mt-1"
                      disabled={!caps.canManageTeams}
                      value={teamDraft.cost ?? 2000}
                      onChange={(e) =>
                        setTeamDraft((p) => ({ ...p, cost: Number(e.target.value) }))
                      }
                    />
                  </label>
                ) : null}
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
                  {caps.canManageTeams ? "Отмена" : "Закрыть"}
                </Button>
                {caps.canManageTeams ? <Button type="submit">Сохранить</Button> : null}
              </div>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
