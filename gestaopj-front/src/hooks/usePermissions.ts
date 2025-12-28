import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Permission,
  hasPermission,
  canCreateProject,
  canEditProject,
  canDeleteProject,
  canManageUsers,
  canInviteUsers,
  canRemoveUsers,
  canChangeUserRoles,
  canAccessBilling,
  canChangePlan,
  canCancelSubscription,
  canEditCompany,
  canTransferOwnership,
  canCancelCompany,
  canManageSettings,
  canViewReports,
  canExportData,
  canCreateBudget,
  canEditBudget,
  canDeleteBudget,
  canCreateInvoice,
  canEditInvoice,
  canDeleteInvoice,
} from "@/utils/permissions";

export function usePermissions() {
  const { user } = useAuth();

  const permissions = useMemo(() => {
    if (!user) {
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
    }

    return {
      hasPermission: (permission: Permission) =>
        hasPermission(user, permission),
      canCreateProject: canCreateProject(user),
      canEditProject: canEditProject(user),
      canDeleteProject: canDeleteProject(user),
      canManageUsers: canManageUsers(user),
      canInviteUsers: canInviteUsers(user),
      canRemoveUsers: canRemoveUsers(user),
      canChangeUserRoles: canChangeUserRoles(user),
      canAccessBilling: canAccessBilling(user),
      canChangePlan: canChangePlan(user),
      canCancelSubscription: canCancelSubscription(user),
      canEditCompany: canEditCompany(user),
      canTransferOwnership: canTransferOwnership(user),
      canCancelCompany: canCancelCompany(user),
      canManageSettings: canManageSettings(user),
      canViewReports: canViewReports(user),
      canExportData: canExportData(user),
      canCreateBudget: canCreateBudget(user),
      canEditBudget: canEditBudget(user),
      canDeleteBudget: canDeleteBudget(user),
      canCreateInvoice: canCreateInvoice(user),
      canEditInvoice: canEditInvoice(user),
      canDeleteInvoice: canDeleteInvoice(user),
    };
  }, [user]);

  return permissions;
}

