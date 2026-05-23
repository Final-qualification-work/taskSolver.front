import { UserPermissions, UserProfile, UserRole } from "@/lib/types";

export const OPTIMIZATION_ROLES: UserRole[] = [
  "admin",
  "project_manager",
  "team_lead",
];

const ROLE_DEFAULTS: Record<UserRole, UserPermissions> = {
  admin: {
    canCreateTasks: true,
    canEditTasks: true,
    canDeleteTasks: true,
    canAssignTeams: true,
    canManageUsers: true,
    canViewReports: true,
    canOptimize: true,
    canManageProjects: true,
    canDeleteProjects: true,
    canManageTeams: true,
  },
  project_manager: {
    canCreateTasks: true,
    canEditTasks: true,
    canDeleteTasks: false,
    canAssignTeams: true,
    canManageUsers: false,
    canViewReports: true,
    canOptimize: true,
    canManageProjects: true,
    canDeleteProjects: false,
    canManageTeams: true,
  },
  team_lead: {
    canCreateTasks: true,
    canEditTasks: true,
    canDeleteTasks: false,
    canAssignTeams: true,
    canManageUsers: false,
    canViewReports: true,
    canOptimize: true,
    canManageProjects: false,
    canDeleteProjects: false,
    canManageTeams: false,
  },
  developer: {
    canCreateTasks: true,
    canEditTasks: true,
    canDeleteTasks: false,
    canAssignTeams: true,
    canManageUsers: false,
    canViewReports: false,
    canOptimize: false,
    canManageProjects: false,
    canDeleteProjects: false,
    canManageTeams: false,
  },
  viewer: {
    canCreateTasks: false,
    canEditTasks: false,
    canDeleteTasks: false,
    canAssignTeams: false,
    canManageUsers: false,
    canViewReports: true,
    canOptimize: false,
    canManageProjects: false,
    canDeleteProjects: false,
    canManageTeams: false,
  },
};

export type Capabilities = Required<
  Pick<
    UserPermissions,
    | "canCreateTasks"
    | "canEditTasks"
    | "canDeleteTasks"
    | "canAssignTeams"
    | "canManageUsers"
    | "canViewReports"
    | "canOptimize"
    | "canManageProjects"
    | "canDeleteProjects"
    | "canManageTeams"
  >
>;

export function getCapabilities(
  user: UserProfile | null | undefined,
): Capabilities {
  const role = (user?.role ?? "viewer") as UserRole;
  const defaults = ROLE_DEFAULTS[role] ?? ROLE_DEFAULTS.viewer;
  const p = user?.permissions ?? {};

  return {
    canCreateTasks: p.canCreateTasks ?? defaults.canCreateTasks ?? false,
    canEditTasks: p.canEditTasks ?? defaults.canEditTasks ?? false,
    canDeleteTasks: p.canDeleteTasks ?? defaults.canDeleteTasks ?? false,
    canAssignTeams: p.canAssignTeams ?? defaults.canAssignTeams ?? false,
    canManageUsers: p.canManageUsers ?? defaults.canManageUsers ?? false,
    canViewReports: p.canViewReports ?? defaults.canViewReports ?? false,
    canOptimize: p.canOptimize ?? defaults.canOptimize ?? false,
    canManageProjects:
      p.canManageProjects ?? defaults.canManageProjects ?? false,
    canDeleteProjects:
      p.canDeleteProjects ?? defaults.canDeleteProjects ?? false,
    canManageTeams: p.canManageTeams ?? defaults.canManageTeams ?? false,
  };
}

export function isReadOnlyUser(user: UserProfile | null | undefined): boolean {
  return getCapabilities(user).canEditTasks === false;
}

export function canAccessOptimization(
  role: UserRole | string | undefined,
): boolean {
  if (!role) return false;
  return getCapabilities({ role } as UserProfile).canOptimize;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Администратор",
  project_manager: "Менеджер проекта",
  team_lead: "Тимлид",
  developer: "Исполнитель",
  viewer: "Наблюдатель",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin:
    "Управление пользователями и ролями, проектами, задачами, командами и оптимизацией распределения.",
  project_manager:
    "Создание и изменение проектов, команд и задач, распределение по командам, аналитика и выбор вариантов оптимизации.",
  team_lead:
    "Редактирование задач и приоритетов, назначение команд, анализ загрузки и оптимизация для своего направления.",
  developer:
    "Создание задач, назначение команды-исполнителя, просмотр задач своей команды и личной загрузки без доступа к оптимизации.",
  viewer:
    "Просмотр проектов, задач и аналитики, экспорт отчётов без изменения данных.",
};
