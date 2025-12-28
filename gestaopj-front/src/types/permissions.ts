import { User, UserRole } from "./user";

export enum Permission {
  // Projetos
  CREATE_PROJECT = "create_project",
  EDIT_PROJECT = "edit_project",
  DELETE_PROJECT = "delete_project",
  VIEW_PROJECTS = "view_projects",

  // Usuários
  MANAGE_USERS = "manage_users",
  INVITE_USERS = "invite_users",
  REMOVE_USERS = "remove_users",
  CHANGE_USER_ROLES = "change_user_roles",

  // Billing e Assinatura
  ACCESS_BILLING = "access_billing",
  CHANGE_PLAN = "change_plan",
  CANCEL_SUBSCRIPTION = "cancel_subscription",

  // Empresa
  EDIT_COMPANY = "edit_company",
  VIEW_COMPANY_DETAILS = "view_company_details",
  TRANSFER_OWNERSHIP = "transfer_ownership",
  CANCEL_COMPANY = "cancel_company",

  // Configurações
  MANAGE_SETTINGS = "manage_settings",

  // Relatórios
  VIEW_REPORTS = "view_reports",
  EXPORT_DATA = "export_data",

  // Orçamentos
  CREATE_BUDGET = "create_budget",
  EDIT_BUDGET = "edit_budget",
  DELETE_BUDGET = "delete_budget",

  // Faturas
  CREATE_INVOICE = "create_invoice",
  EDIT_INVOICE = "edit_invoice",
  DELETE_INVOICE = "delete_invoice",
}

// Mapeamento de roles para permissões
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: [
    // Todas as permissões
    Permission.CREATE_PROJECT,
    Permission.EDIT_PROJECT,
    Permission.DELETE_PROJECT,
    Permission.VIEW_PROJECTS,
    Permission.MANAGE_USERS,
    Permission.INVITE_USERS,
    Permission.REMOVE_USERS,
    Permission.CHANGE_USER_ROLES,
    Permission.ACCESS_BILLING,
    Permission.CHANGE_PLAN,
    Permission.CANCEL_SUBSCRIPTION,
    Permission.EDIT_COMPANY,
    Permission.VIEW_COMPANY_DETAILS,
    Permission.TRANSFER_OWNERSHIP,
    Permission.CANCEL_COMPANY,
    Permission.MANAGE_SETTINGS,
    Permission.VIEW_REPORTS,
    Permission.EXPORT_DATA,
    Permission.CREATE_BUDGET,
    Permission.EDIT_BUDGET,
    Permission.DELETE_BUDGET,
    Permission.CREATE_INVOICE,
    Permission.EDIT_INVOICE,
    Permission.DELETE_INVOICE,
  ],
  admin: [
    // Gestão operacional completa (sem billing e transferência)
    Permission.CREATE_PROJECT,
    Permission.EDIT_PROJECT,
    Permission.DELETE_PROJECT,
    Permission.VIEW_PROJECTS,
    Permission.MANAGE_USERS,
    Permission.INVITE_USERS,
    Permission.REMOVE_USERS,
    Permission.CHANGE_USER_ROLES,
    Permission.EDIT_COMPANY,
    Permission.VIEW_COMPANY_DETAILS,
    Permission.MANAGE_SETTINGS,
    Permission.VIEW_REPORTS,
    Permission.EXPORT_DATA,
    Permission.CREATE_BUDGET,
    Permission.EDIT_BUDGET,
    Permission.DELETE_BUDGET,
    Permission.CREATE_INVOICE,
    Permission.EDIT_INVOICE,
    Permission.DELETE_INVOICE,
    // Nota: ADMIN não tem CHANGE_PLAN, CANCEL_SUBSCRIPTION, TRANSFER_OWNERSHIP
  ],
  member: [
    // Acesso limitado
    Permission.VIEW_PROJECTS,
    Permission.VIEW_REPORTS,
    Permission.CREATE_PROJECT,
  ],
  viewer: [
    // Apenas visualização
    Permission.VIEW_PROJECTS,
    Permission.VIEW_REPORTS,
  ],
};

/**
 * Verifica se um usuário tem uma permissão específica (deprecated - use roleHasPermission)
 * @deprecated Use roleHasPermission com o role da membership
 */
export function hasPermission(user: User, permission: Permission): boolean {
  // Esta função não funciona mais porque User não tem role
  // Mantida apenas para compatibilidade - deve ser substituída
  console.warn("hasPermission(user, permission) está deprecated. Use roleHasPermission(role, permission)");
  return false;
}

/**
 * Verifica se um role tem uma permissão específica
 */
export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  const rolePermissions = ROLE_PERMISSIONS[role] || [];
  return rolePermissions.includes(permission);
}

/**
 * Retorna todas as permissões de um role
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

// Funções de conveniência para permissões comuns
export const canCreateProject = (user: User) =>
  hasPermission(user, Permission.CREATE_PROJECT);

export const canEditProject = (user: User) =>
  hasPermission(user, Permission.EDIT_PROJECT);

export const canDeleteProject = (user: User) =>
  hasPermission(user, Permission.DELETE_PROJECT);

export const canManageUsers = (user: User) =>
  hasPermission(user, Permission.MANAGE_USERS);

export const canInviteUsers = (user: User) =>
  hasPermission(user, Permission.INVITE_USERS);

export const canRemoveUsers = (user: User) =>
  hasPermission(user, Permission.REMOVE_USERS);

export const canChangeUserRoles = (user: User) =>
  hasPermission(user, Permission.CHANGE_USER_ROLES);

export const canAccessBilling = (user: User) =>
  hasPermission(user, Permission.ACCESS_BILLING);

export const canChangePlan = (user: User) =>
  hasPermission(user, Permission.CHANGE_PLAN);

export const canCancelSubscription = (user: User) =>
  hasPermission(user, Permission.CANCEL_SUBSCRIPTION);

export const canEditCompany = (user: User) =>
  hasPermission(user, Permission.EDIT_COMPANY);

export const canTransferOwnership = (user: User) =>
  hasPermission(user, Permission.TRANSFER_OWNERSHIP);

export const canCancelCompany = (user: User) =>
  hasPermission(user, Permission.CANCEL_COMPANY);

export const canManageSettings = (user: User) =>
  hasPermission(user, Permission.MANAGE_SETTINGS);

export const canViewReports = (user: User) =>
  hasPermission(user, Permission.VIEW_REPORTS);

export const canExportData = (user: User) =>
  hasPermission(user, Permission.EXPORT_DATA);

export const canCreateBudget = (user: User) =>
  hasPermission(user, Permission.CREATE_BUDGET);

export const canEditBudget = (user: User) =>
  hasPermission(user, Permission.EDIT_BUDGET);

export const canDeleteBudget = (user: User) =>
  hasPermission(user, Permission.DELETE_BUDGET);

export const canCreateInvoice = (user: User) =>
  hasPermission(user, Permission.CREATE_INVOICE);

export const canEditInvoice = (user: User) =>
  hasPermission(user, Permission.EDIT_INVOICE);

export const canDeleteInvoice = (user: User) =>
  hasPermission(user, Permission.DELETE_INVOICE);

