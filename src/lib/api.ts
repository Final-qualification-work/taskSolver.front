import {
  ApiResponse,
  DashboardAnalytics,
  DistributionChartData,
  LoadChartData,
  PersonalizedRecommendation,
  Project,
  TaskItem,
  TaskStats,
  Team,
  TeamLoad,
  TeamTasksData,
  UserListItem,
  UserPreferences,
  UserProfile,
} from "@/lib/types";

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
    const message =
      typeof data?.message === "string"
        ? data.message
        : typeof data?.error === "string"
          ? data.error
          : "Ошибка запроса";
    throw new Error(message);
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
  projectId?: number;
  assignedTeamId?: number;
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

export type OptimizeResponse = ApiResponse<{
  summary: {
    totalTeams: number;
    totalTasks: number;
    solutionsCount: number;
  };
  paretoFront: import("@/lib/types").OptimizationSolution[];
}>;

function buildQuery(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== "");
  if (!entries.length) return "";
  return "?" + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");
}

export const api = {
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

  getProjects: () => request<ApiResponse<Project[]>>("/projects"),

  getProjectById: (id: number) => request<ApiResponse<Project>>(`/projects/${id}`),

  getProjectTasks: (id: number, filters?: { status?: string; priority?: number }) =>
    request<ApiResponse<TeamTasksData>>(`/projects/${id}/tasks` + buildQuery({ ...filters })),

  getProjectStatistics: (id: number) =>
    request<ApiResponse<Record<string, unknown>>>(`/projects/${id}/statistics`),

  createProject: (payload: Partial<Project>) =>
    request<ApiResponse<Project>>("/projects", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateProject: (id: number, payload: Partial<Project>) =>
    request<ApiResponse<Project>>(`/projects/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  deleteProject: (id: number) =>
    request<ApiResponse<null>>(`/projects/${id}`, { method: "DELETE" }),

  addTaskToProject: (projectId: number, payload: Partial<TaskItem>) =>
    request<ApiResponse<TaskItem>>(`/projects/${projectId}/tasks`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

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

  optimize: () => request<OptimizeResponse>("/tasks/optimize"),

  applyOptimization: (point: string) =>
    request<ApiResponse<{ point: string; name: string }>>("/tasks/optimize/apply", {
      method: "POST",
      body: JSON.stringify({ point }),
    }),

  exportTasksCsv: async (filters?: { status?: string; tag?: string }) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    const query = buildQuery({ format: "csv", ...filters });
    const response = await fetch(`${API_BASE_URL}/tasks/export${query}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.message || "Не удалось экспортировать задачи");
    }
    const blob = await response.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `tasks_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  },

  getUsers: () => request<ApiResponse<UserListItem[]>>("/users"),

  createUser: (payload: {
    username: string;
    email: string;
    password: string;
    role: string;
    teamId?: number | null;
    isActive?: boolean;
  }) =>
    request<ApiResponse<UserListItem>>("/users", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateUser: (
    id: number,
    payload: Partial<{
      username: string;
      email: string;
      password: string;
      role: string;
      teamId: number | null;
      isActive: boolean;
    }>,
  ) =>
    request<ApiResponse<UserListItem>>(`/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  deleteUser: (id: number) =>
    request<ApiResponse<null>>(`/users/${id}`, { method: "DELETE" }),

  getLoadChart: () =>
    request<ApiResponse<LoadChartData>>("/visualization/load-chart"),

  getTaskDistribution: (projectId?: number) =>
    request<ApiResponse<DistributionChartData>>(
      "/visualization/task-distribution" + buildQuery({ projectId }),
    ),

  getDashboardAnalytics: () =>
    request<ApiResponse<DashboardAnalytics>>("/visualization/dashboard"),

  getParetoVisualization: () =>
    request<ApiResponse<{ paretoFront: import("@/lib/types").ParetoVizPoint[]; chartConfig: Record<string, string> }>>(
      "/visualization/pareto-front",
    ),

  getPreferences: () =>
    request<ApiResponse<UserPreferences>>("/visualization/preferences"),

  updatePreferences: (payload: Partial<UserPreferences>) =>
    request<ApiResponse<UserPreferences>>("/visualization/preferences", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  getPersonalizedRecommendations: () =>
    request<ApiResponse<PersonalizedRecommendation>>("/visualization/recommendations"),

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
