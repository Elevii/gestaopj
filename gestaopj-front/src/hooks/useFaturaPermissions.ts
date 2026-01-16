import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { usePermissions } from "./usePermissions";

export function useFaturaPermissions() {
  const { user } = useAuth();
  const { company } = useCompany();
  const { currentRole } = usePermissions();

  const permissions = useMemo(() => {
    if (!user || !company || !currentRole) {
      return {
        canViewAllInvoices: false,
        canGenerateInvoices: false,
        canApproveInvoiceSteps: false,
        canApproveInvoices: false,
        canManageInvoiceSteps: false,
        canViewOwnInvoices: false,
        canEditInvoices: false,
        canDeleteInvoices: false,
      };
    }

    // Owner e Admin têm todas as permissões
    const isAdminOrOwner = currentRole === "owner" || currentRole === "admin";

    return {
      // Ver todas as faturas da empresa
      canViewAllInvoices: isAdminOrOwner,
      // Gerar faturas
      canGenerateInvoices: isAdminOrOwner,
      // Aprovar etapas de faturas
      canApproveInvoiceSteps: isAdminOrOwner,
      // Aprovar faturas
      canApproveInvoices: isAdminOrOwner,
      // Gerenciar etapas de faturamento
      canManageInvoiceSteps: isAdminOrOwner,
      // Ver próprias faturas (todos podem)
      canViewOwnInvoices: true,
      // Editar faturas
      canEditInvoices: isAdminOrOwner,
      // Deletar faturas
      canDeleteInvoices: isAdminOrOwner,
    };
  }, [user, company, currentRole]);

  return permissions;
}




