"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Project,
  ProjectStatus,
  TagType,
  TaskItem,
  TaskStatus,
} from "@/lib/types";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const projectStatusLabels: Record<ProjectStatus, string> = {
  planning: "Планирование",
  active: "Активный",
  completed: "Завершён",
  on_hold: "На паузе",
};

const tagOptions: TagType[] = ["frontend", "backend", "ML"];

function toDateInputValue(iso?: string | null): string {
  if (!iso) return "";
  return String(iso).slice(0, 10);
}

type ProjectsPanelProps = {
  onError: (msg: string) => void;
  onTasksChanged: () => void;
  statusLabels: Record<TaskStatus, string>;
};

export function ProjectsPanel({ onError, onTasksChanged, statusLabels }: ProjectsPanelProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);

  const [projectForm, setProjectForm] = useState({
    name: "",
    description: "",
    status: "planning" as ProjectStatus,
    budget: "",
    startDate: "",
    endDate: "",
  });

  const [taskForm, setTaskForm] = useState({
    name: "",
    description: "",
    tag: "frontend" as TagType,
    complexity: 5,
    deadline: "",
    business_priority: 2,
    status: "backlog" as TaskStatus,
  });

  async function loadProjects() {
    setIsLoading(true);
    try {
      const res = await api.getProjects();
      setProjects(res.data || []);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Не удалось загрузить проекты");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadDetail(id: number) {
    setIsLoading(true);
    try {
      const res = await api.getProjectById(id);
      setDetail(res.data);
      setSelectedId(id);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Не удалось загрузить проект");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  function openEditProject() {
    if (!detail) return;
    setProjectForm({
      name: detail.name,
      description: detail.description ?? "",
      status: detail.status,
      budget: detail.budget != null ? String(detail.budget) : "",
      startDate: toDateInputValue(detail.startDate),
      endDate: toDateInputValue(detail.endDate),
    });
    setShowEdit(true);
  }

  async function handleUpdateProject(e: FormEvent) {
    e.preventDefault();
    if (!detail) return;
    try {
      await api.updateProject(detail.id, {
        name: projectForm.name,
        description: projectForm.description || null,
        status: projectForm.status,
        budget: projectForm.budget ? Number(projectForm.budget) : null,
        startDate: projectForm.startDate || null,
        endDate: projectForm.endDate || null,
      });
      setShowEdit(false);
      await loadProjects();
      await loadDetail(detail.id);
      onTasksChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Не удалось обновить проект");
    }
  }

  async function handleCreateProject(e: FormEvent) {
    e.preventDefault();
    try {
      await api.createProject({
        name: projectForm.name,
        description: projectForm.description || null,
        status: projectForm.status,
        budget: projectForm.budget ? Number(projectForm.budget) : null,
        startDate: projectForm.startDate || null,
        endDate: projectForm.endDate || null,
      });
      setShowCreate(false);
      setProjectForm({
        name: "",
        description: "",
        status: "planning",
        budget: "",
        startDate: "",
        endDate: "",
      });
      await loadProjects();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Не удалось создать проект");
    }
  }

  async function handleAddTask(e: FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    try {
      await api.addTaskToProject(selectedId, {
        ...taskForm,
        deadline: taskForm.deadline || new Date().toISOString(),
      });
      setShowAddTask(false);
      setTaskForm({
        name: "",
        description: "",
        tag: "frontend",
        complexity: 5,
        deadline: "",
        business_priority: 2,
        status: "backlog",
      });
      await loadDetail(selectedId);
      onTasksChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Не удалось добавить задачу");
    }
  }

  async function handleDeleteProject(id: number) {
    if (!confirm("Удалить проект? Задачи останутся без проекта.")) return;
    try {
      await api.deleteProject(id);
      if (selectedId === id) {
        setSelectedId(null);
        setDetail(null);
      }
      await loadProjects();
      onTasksChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Не удалось удалить проект");
    }
  }

  const tasks = detail?.tasks ?? [];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Проекты</h2>
          <p className="text-sm text-warm-muted">Задачи создаются внутри проекта (POST /projects/:id/tasks)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadProjects} disabled={isLoading}>
            Обновить
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            Новый проект
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-2 lg:col-span-1">
          {projects.length === 0 && !isLoading && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-warm-muted">
                Нет проектов. Создайте первый.
              </CardContent>
            </Card>
          )}
          {projects.map((p) => (
            <Card
              key={p.id}
              className={cn(
                "cursor-pointer transition-colors hover:border-accent-primary/40",
                selectedId === p.id && "border-accent-primary/60 bg-accent-primary/10",
              )}
              onClick={() => loadDetail(p.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  <Badge variant="outline">{projectStatusLabels[p.status]}</Badge>
                </div>
                <CardDescription className="line-clamp-2">
                  {p.description || "Без описания"}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-warm-muted">
                Задач: {p.stats?.totalTasks ?? 0} · готово {p.stats?.completionRate ?? 0}%
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="lg:col-span-2">
          {!detail ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-warm-muted">
                Выберите проект слева
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle>{detail.name}</CardTitle>
                      <CardDescription>{detail.description}</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={openEditProject}>
                        Изменить
                      </Button>
                      <Button size="sm" onClick={() => setShowAddTask(true)}>
                        Задача в проект
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteProject(detail.id)}
                      >
                        Удалить
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-2 text-sm md:grid-cols-4">
                  <div>
                    <span className="text-warm-muted">Статус</span>
                    <p>{projectStatusLabels[detail.status]}</p>
                  </div>
                  <div>
                    <span className="text-warm-muted">Задач</span>
                    <p>{detail.stats?.totalTasks ?? tasks.length}</p>
                  </div>
                  <div>
                    <span className="text-warm-muted">В работе</span>
                    <p>{detail.stats?.inProgressTasks ?? 0}</p>
                  </div>
                  <div>
                    <span className="text-warm-muted">Готовность</span>
                    <p>{detail.stats?.completionRate ?? 0}%</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Задачи проекта</CardTitle>
                  <CardDescription>GET /projects/{detail.id}/tasks</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {tasks.length === 0 ? (
                    <p className="text-sm text-warm-muted">В проекте пока нет задач</p>
                  ) : (
                    tasks.map((task: TaskItem) => (
                      <div
                        key={task.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-background px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium">{task.name}</p>
                          <p className="text-xs text-warm-muted">
                            {task.tag} · P{task.business_priority} · {statusLabels[task.status]}
                          </p>
                        </div>
                        <span className="text-xs text-warm-muted">
                          {task.assignedTeam?.name ?? "без команды"}
                        </span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новый проект</DialogTitle>
            <DialogDescription>POST /api/projects</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateProject} className="grid gap-3">
            <label className="text-sm text-warm-muted">
              Название
              <Input className="mt-1" value={projectForm.name} onChange={(e) => setProjectForm((p) => ({ ...p, name: e.target.value }))} required />
            </label>
            <label className="text-sm text-warm-muted">
              Описание
              <Textarea className="mt-1" value={projectForm.description} onChange={(e) => setProjectForm((p) => ({ ...p, description: e.target.value }))} />
            </label>
            <label className="text-sm text-warm-muted">
              Статус
              <Select value={projectForm.status} onValueChange={(v) => setProjectForm((p) => ({ ...p, status: v as ProjectStatus }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(projectStatusLabels) as ProjectStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{projectStatusLabels[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="text-sm text-warm-muted">
              Бюджет
              <Input type="number" className="mt-1" value={projectForm.budget} onChange={(e) => setProjectForm((p) => ({ ...p, budget: e.target.value }))} />
            </label>
            <label className="text-sm text-warm-muted">
              Дата начала
              <Input type="date" className="mt-1" value={projectForm.startDate} onChange={(e) => setProjectForm((p) => ({ ...p, startDate: e.target.value }))} />
            </label>
            <label className="text-sm text-warm-muted">
              Дата окончания
              <Input type="date" className="mt-1" value={projectForm.endDate} onChange={(e) => setProjectForm((p) => ({ ...p, endDate: e.target.value }))} />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Отмена</Button>
              <Button type="submit">Создать</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать проект</DialogTitle>
            <DialogDescription>PUT /api/projects/{detail?.id}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateProject} className="grid gap-3">
            <label className="text-sm text-warm-muted">
              Название
              <Input className="mt-1" value={projectForm.name} onChange={(e) => setProjectForm((p) => ({ ...p, name: e.target.value }))} required />
            </label>
            <label className="text-sm text-warm-muted">
              Описание
              <Textarea className="mt-1" value={projectForm.description} onChange={(e) => setProjectForm((p) => ({ ...p, description: e.target.value }))} />
            </label>
            <label className="text-sm text-warm-muted">
              Статус
              <Select value={projectForm.status} onValueChange={(v) => setProjectForm((p) => ({ ...p, status: v as ProjectStatus }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(projectStatusLabels) as ProjectStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{projectStatusLabels[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="text-sm text-warm-muted">
              Бюджет
              <Input type="number" className="mt-1" value={projectForm.budget} onChange={(e) => setProjectForm((p) => ({ ...p, budget: e.target.value }))} />
            </label>
            <label className="text-sm text-warm-muted">
              Дата начала
              <Input type="date" className="mt-1" value={projectForm.startDate} onChange={(e) => setProjectForm((p) => ({ ...p, startDate: e.target.value }))} />
            </label>
            <label className="text-sm text-warm-muted">
              Дата окончания
              <Input type="date" className="mt-1" value={projectForm.endDate} onChange={(e) => setProjectForm((p) => ({ ...p, endDate: e.target.value }))} />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowEdit(false)}>Отмена</Button>
              <Button type="submit">Сохранить</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddTask} onOpenChange={setShowAddTask}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Задача в «{detail?.name}»</DialogTitle>
            <DialogDescription>POST /api/projects/{selectedId}/tasks</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddTask} className="grid gap-3 md:grid-cols-2">
            <label className="text-sm text-warm-muted md:col-span-2">
              Название
              <Input className="mt-1" value={taskForm.name} onChange={(e) => setTaskForm((p) => ({ ...p, name: e.target.value }))} required />
            </label>
            <label className="text-sm text-warm-muted md:col-span-2">
              Описание
              <Textarea className="mt-1" value={taskForm.description} onChange={(e) => setTaskForm((p) => ({ ...p, description: e.target.value }))} required />
            </label>
            <label className="text-sm text-warm-muted">
              Тег
              <select className="mt-1 h-10 w-full rounded-xl border border-border-soft bg-white px-3 text-sm" value={taskForm.tag} onChange={(e) => setTaskForm((p) => ({ ...p, tag: e.target.value as TagType }))}>
                {tagOptions.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label className="text-sm text-warm-muted">
              Приоритет (1–3)
              <Input type="number" min={1} max={3} className="mt-1" value={taskForm.business_priority} onChange={(e) => setTaskForm((p) => ({ ...p, business_priority: Number(e.target.value) }))} />
            </label>
            <label className="text-sm text-warm-muted md:col-span-2">
              Дедлайн
              <Input type="datetime-local" className="mt-1" value={taskForm.deadline} onChange={(e) => setTaskForm((p) => ({ ...p, deadline: e.target.value }))} required />
            </label>
            <div className="flex justify-end gap-2 md:col-span-2">
              <Button type="button" variant="outline" onClick={() => setShowAddTask(false)}>Отмена</Button>
              <Button type="submit">Добавить</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
