export type TagType = "frontend" | "backend" | "ML";

export type TaskStatus =
  | "not groomed"
  | "backlog"
  | "todo"
  | "in progress"
  | "done";

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
  team: string;
  tasks: TaskItem[];
  stats: TeamTasksStats;
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
