import { ApiResponse, TaskItem, TaskStats, Team, TeamLoad, TeamTasksData, UserProfile } from "@/lib/types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
    ...init,
  });

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await response.json() : null;

  if (!isJson) {
    throw new Error("Сервер вернул не JSON. Проверьте URL API и доступность бэкенда.");
  }

  if (!response.ok || data.success === false) {
    throw new Error(data.message || "Ошибка запроса");
  }

  return data as T;
}

export type TaskFilters = {
  status?: string;
  tag?: string;
  priority_min?: number;
  priority_max?: number;
  complexity_min?: number;
  complexity_max?: number;
  sort_by?: "createdAt" | "updatedAt" | "business_priority" | "complexity" | "deadline" | "name";
  sort_order?: "ASC" | "DESC";
  page?: number;
  limit?: number;
};

export type TeamFilters = {
  tag?: string;
  minLoad?: number;
  maxLoad?: number;
  search?: string;
};

export type TasksListResponse = ApiResponse<TaskItem[]> & {
  totalPages?: number;
  currentPage?: number;
};

export type AuthResponse = ApiResponse<UserProfile> & {
  token: string;
};

function buildQuery(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== "");
  if (!entries.length) return "";
  return "?" + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");
}

export const api = {
  // ── Teams ──────────────────────────────────────────────────────────────────
  getTeams: (filters?: TeamFilters) =>
    request<ApiResponse<Team[]>>("/teams" + buildQuery({ ...filters })),

  getTeamById: (id: number) =>
    request<ApiResponse<Team>>(`/teams/${id}`),

  getTeamTasks: (id: number, filters?: { status?: string; priority?: number }) =>
    request<ApiResponse<TeamTasksData>>(`/teams/${id}/tasks` + buildQuery({ ...filters })),

  getTeamLoad: () =>
    request<ApiResponse<TeamLoad[]>>("/teams/load"),

  createTeam: (payload: Partial<Team>) =>
    request<ApiResponse<Team>>("/teams", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateTeam: (id: number, payload: Partial<Team>) =>
    request<ApiResponse<Team>>(`/teams/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  deleteTeam: (id: number) =>
    request<ApiResponse<null>>(`/teams/${id}`, { method: "DELETE" }),

  // ── Tasks ──────────────────────────────────────────────────────────────────
  getTasks: (filters?: TaskFilters) =>
    request<TasksListResponse>(
      "/tasks" + buildQuery({ limit: 100, ...filters }),
    ),

  getTaskById: (id: number) =>
    request<ApiResponse<TaskItem>>(`/tasks/${id}`),

  getTaskStats: () =>
    request<ApiResponse<TaskStats>>("/tasks/statistics"),

  createTask: (payload: Partial<TaskItem>) =>
    request<ApiResponse<TaskItem>>("/tasks", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateTask: (id: number, payload: Partial<TaskItem>) =>
    request<ApiResponse<TaskItem>>(`/tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  deleteTask: (id: number) =>
    request<ApiResponse<null>>(`/tasks/${id}`, { method: "DELETE" }),

  bulkUpdateTasks: (updates: Array<{ taskId: number; [key: string]: unknown }>) =>
    request<ApiResponse<{ success: unknown[]; failed: unknown[] }>>("/tasks/bulk-update", {
      method: "POST",
      body: JSON.stringify({ updates }),
    }),

  // ── Optimization ───────────────────────────────────────────────────────────
  optimize: () => request<ApiResponse<unknown>>("/tasks/optimize"),
  applyOptimization: (point: string) =>
    request<ApiResponse<{ point: string; name: string }>>("/tasks/optimize/apply", {
      method: "POST",
      body: JSON.stringify({ point }),
    }),

  // ── Auth ───────────────────────────────────────────────────────────────────
  register: (payload: {
    username: string;
    email: string;
    password: string;
    role?: string;
    teamId?: number;
  }) =>
    request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  login: (payload: { email: string; password: string }) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getMe: () => request<ApiResponse<UserProfile>>("/auth/me"),
};
