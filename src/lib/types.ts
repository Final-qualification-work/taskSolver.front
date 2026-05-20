export type TagType = "frontend" | "backend" | "ML";

export type TaskStatus =
  | "not groomed"
  | "backlog"
  | "todo"
  | "in progress"
  | "done";

export type ProjectStatus = "planning" | "active" | "completed" | "on_hold";

export interface Team {
  id: number;
  name: string;
  tag: TagType;
  cost: number;
  capacity: number;
  currentLoad: number;
  loadPercentage?: number | string;
  availableCapacity?: number;
  tasksCount?: number;
  isOverloaded?: boolean;
  isUnderloaded?: boolean;
}

export interface ProjectStats {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  backlogTasks: number;
  completionRate: string | number;
  totalComplexity?: number;
}

export interface Project {
  id: number;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  startDate?: string | null;
  endDate?: string | null;
  budget?: number | null;
  teamIds?: number[];
  createdBy: number;
  creator?: { id: number; username: string; email?: string };
  stats?: ProjectStats;
  tasks?: TaskItem[];
}

export interface TeamTasksStats {
  total: number;
  byStatus: {
    backlog: number;
    todo: number;
    in_progress: number;
    done: number;
  };
  totalComplexity: number;
  avgPriority: string;
}

export interface TeamTasksData {
  project?: string;
  team?: string;
  tasks: TaskItem[];
  stats?: TeamTasksStats;
  count?: number;
}

export interface TeamLoad {
  id: number;
  name: string;
  tag: TagType;
  capacity: number;
  currentLoad: number;
  available: number;
  loadPercentage: string;
}

export interface TaskStats {
  total: number;
  byStatus: Array<{ status: string; count: number | string }>;
  byTag: Array<{ tag: string; count: number | string }>;
  averageComplexity: number | string;
  upcomingDeadlines?: TaskItem[];
  unassignedTasks?: number;
}

export interface TaskItem {
  id: number;
  name: string;
  description: string;
  tag: TagType;
  complexity: number;
  deadline: string;
  business_priority: number;
  status: TaskStatus;
  assignedTeamId: number | null;
  projectId?: number | null;
  assignedTeam?: Team | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  count?: number;
  totalPages?: number;
  currentPage?: number;
}

export type UserRole = "admin" | "project_manager" | "team_lead" | "developer" | "viewer";

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  role: UserRole;
}

export interface UserPreferences {
  id: number;
  userId: number;
  weightCost: number;
  weightLoad: number;
  weightPreference: number;
  maxLoadThreshold: number;
  minPreferenceThreshold: number;
  preferredTeamIds: number[];
  preferredTags: TagType[];
  notificationsEnabled?: boolean;
  dashboardLayout?: Record<string, unknown>;
}

export interface LoadChartTeam {
  teamId: number;
  teamName: string;
  tag: TagType;
  currentLoad: number;
  capacity: number;
  loadPercentage: string;
  status: "normal" | "warning" | "critical" | "underloaded";
  cost: number;
  tasksCount: number;
}

export interface LoadChartData {
  chartType: string;
  title: string;
  data: LoadChartTeam[];
  summary: {
    averageLoad: string;
    criticalTeams: number;
    underloadedTeams: number;
  };
}

export interface DistributionChartData {
  byStatus: Array<{ name: string; value: number }>;
  byTag: Array<{ name: string; value: number }>;
  byTeam: Array<{ name: string; value: number }>;
  byPriority: Array<{ priority: number; count: number; label: string }>;
  total: number;
}

export interface DashboardAnalytics {
  metrics: {
    totalTeams: number;
    totalProjects: number;
    totalTasks: number;
    completionRate: string;
    totalCost: string;
    estimatedSavings: string;
    averageLoad: string;
    efficiency: string;
  };
  teamLoadHistory: Array<{
    teamId: number;
    teamName: string;
    currentLoad: number;
    capacity: number;
    loadPercentage: string;
    available: number;
  }>;
  projectStats: Array<{
    id: number;
    name: string;
    status: ProjectStatus;
    totalTasks: number;
    completedTasks: number;
    completionRate: string;
    budget: number | null;
    spent: number;
  }>;
  taskStatus: {
    completed: number;
    inProgress: number;
    backlog: number;
    total: number;
  };
  timestamp: string;
}

export interface ParetoVizPoint {
  point: string;
  cost: number;
  load: string;
  preference: number;
  weights: { alpha: number; beta: number; gamma: number };
}

export interface OptimizationWeights {
  alpha: number;
  beta: number;
  gamma: number;
}

export interface OptimizationSolution {
  point: string;
  name: string;
  weights: OptimizationWeights;
  metrics: {
    totalCost: string;
    maxLoad: string;
    maxLoadValue?: string;
    totalPreference: string;
  };
  assignments?: Array<{
    taskName: string;
    teamName: string;
    complexity: number;
    cost: number;
  }>;
  teamLoads?: Array<{
    teamName: string;
    load: number;
    capacity: number;
    percentage: string;
  }>;
}

export interface PersonalizedRecommendation {
  userWeights: OptimizationWeights;
  thresholds: { maxLoad: number; minPreference: number };
  recommendedSolution: {
    assignmentMatrix?: number[][];
    teamLoads: Record<string, number>;
    allTasksAssigned?: boolean;
  };
}
