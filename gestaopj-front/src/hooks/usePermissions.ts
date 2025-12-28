import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import {
  Permission,
  roleHasPermission,
} from "@/types/permissions";
import { UserRole } from "@/types/user";

export function usePermissions() {
  const { user, userCompanies } = useAuth();
  const { company } = useCompany();

  const currentRole = useMemo<UserRole | null>(() => {
    if (!user || !company) return null;
    const membership = userCompanies.find((m) => m.companyId === company.id);
    return membership?.role || null;
  }, [user, company, userCompanies]);

  const permissions = useMemo(() => {
    if (!user || !currentRole)
      return {
        hasPermission: () => false,
        canCreateProject: false,
        canEditProject: false,
        canDeleteProject: false,
        canManageUsers: false,
        canInviteUsers: false,
        canRemoveUsers: false,
        canChangeUserRoles: false,
        canAccessBilling: false,
        canChangePlan: false,
        canCancelSubscription: false,
        canEditCompany: false,
        canTransferOwnership: false,
        canCancelCompany: false,
        canManageSettings: false,
        canViewReports: false,
        canExportData: false,
        canCreateBudget: false,
        canEditBudget: false,
        canDeleteBudget: false,
        canCreateInvoice: false,
        canEditInvoice: false,
        canDeleteInvoice: false,
      };

    return {
      hasPermission: (permission: Permission) =>
        roleHasPermission(currentRole, permission),
      canCreateProject: roleHasPermission(currentRole, Permission.CREATE_PROJECT),
      canEditProject: roleHasPermission(currentRole, Permission.EDIT_PROJECT),
      canDeleteProject: roleHasPermission(currentRole, Permission.DELETE_PROJECT),
      canManageUsers: roleHasPermission(currentRole, Permission.MANAGE_USERS),
      canInviteUsers: roleHasPermission(currentRole, Permission.INVITE_USERS),
      canRemoveUsers: roleHasPermission(currentRole, Permission.REMOVE_USERS),
      canChangeUserRoles: roleHasPermission(currentRole, Permission.CHANGE_USER_ROLES),
      canAccessBilling: roleHasPermission(currentRole, Permission.ACCESS_BILLING),
      canChangePlan: roleHasPermission(currentRole, Permission.CHANGE_PLAN),
      canCancelSubscription: roleHasPermission(currentRole, Permission.CANCEL_SUBSCRIPTION),
      canEditCompany: roleHasPermission(currentRole, Permission.EDIT_COMPANY),
      canTransferOwnership: roleHasPermission(currentRole, Permission.TRANSFER_OWNERSHIP),
      canCancelCompany: roleHasPermission(currentRole, Permission.CANCEL_COMPANY),
      canManageSettings: roleHasPermission(currentRole, Permission.MANAGE_SETTINGS),
      canViewReports: roleHasPermission(currentRole, Permission.VIEW_REPORTS),
      canExportData: roleHasPermission(currentRole, Permission.EXPORT_DATA),
      canCreateBudget: roleHasPermission(currentRole, Permission.CREATE_BUDGET),
      canEditBudget: roleHasPermission(currentRole, Permission.EDIT_BUDGET),
      canDeleteBudget: roleHasPermission(currentRole, Permission.DELETE_BUDGET),
      canCreateInvoice: roleHasPermission(currentRole, Permission.CREATE_INVOICE),
      canEditInvoice: roleHasPermission(currentRole, Permission.EDIT_INVOICE),
      canDeleteInvoice: roleHasPermission(currentRole, Permission.DELETE_INVOICE),
    };
  }, [user, currentRole]);

  return permissions;
}

