"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useFaturaEtapa } from "@/contexts/FaturaEtapaContext";
import { useFaturaPermissions } from "@/hooks/useFaturaPermissions";
import { TipoEtapa } from "@/types";
import { faturaEtapaService } from "@/services/faturaEtapaService";

const TIPO_ETAPA_OPTIONS: { value: TipoEtapa; label: string }[] = [
  { value: "envio_relatorio", label: "Envio de Relatório" },
  { value: "geracao_nota_fiscal", label: "Geração de Nota Fiscal" },
  { value: "outro", label: "Outro" },
];

export default function EditarEtapaPage() {
  const router = useRouter();
  const params = useParams();
  const etapaId = params.id as string;
  const { updateEtapa } = useFaturaEtapa();
  const { canManageInvoiceSteps } = useFaturaPermissions();

  const [formData, setFormData] = useState({
    nome: "",
    tipo: "envio_relatorio" as TipoEtapa,
    dataLimite: "",
    requerAnexo: false,
    ativo: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadingEtapa, setLoadingEtapa] = useState(true);

  useEffect(() => {
    const loadEtapa = async () => {
      try {
        setLoadingEtapa(true);
        const etapa = await faturaEtapaService.findById(etapaId);
        if (!etapa) {
          router.push("/dashboard/financeiro/etapas");
          return;
        }

        setFormData({
          nome: etapa.nome,
          tipo: etapa.tipo,
          dataLimite: etapa.dataLimite || "",
          requerAnexo: etapa.requerAnexo,
          ativo: etapa.ativo,
        });
      } catch (error) {
        console.error("Erro ao carregar etapa:", error);
        router.push("/dashboard/financeiro/etapas");
      } finally {
        setLoadingEtapa(false);
      }
    };

    if (etapaId) {
      loadEtapa();
    }
  }, [etapaId, router]);

  if (!canManageInvoiceSteps) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">
            Você não tem permissão para editar etapas de faturamento.
          </p>
        </div>
      </div>
    );
  }

  if (loadingEtapa) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Carregando etapa...</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validação
    const newErrors: Record<string, string> = {};
    if (!formData.nome.trim()) {
      newErrors.nome = "Nome da etapa é obrigatório";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    try {
      await updateEtapa(etapaId, {
        nome: formData.nome.trim(),
        tipo: formData.tipo,
        dataLimite: formData.dataLimite || undefined,
        requerAnexo: formData.requerAnexo,
        ativo: formData.ativo,
      });
      router.push("/dashboard/financeiro/etapas");
    } catch (error: any) {
      console.error("Erro ao atualizar etapa:", error);
      setErrors({ submit: error?.message || "Erro ao atualizar etapa. Tente novamente." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Editar Etapa</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Atualize as informações da etapa de faturamento
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Nome da Etapa *
            </label>
            <input
              type="text"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:text-white ${
                errors.nome
                  ? "border-red-500"
                  : "border-gray-300 dark:border-gray-600"
              }`}
              placeholder="Ex: Envio de relatório mensal"
            />
            {errors.nome && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.nome}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tipo de Etapa *
            </label>
            <select
              value={formData.tipo}
              onChange={(e) => setFormData({ ...formData, tipo: e.target.value as TipoEtapa })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:text-white"
            >
              {TIPO_ETAPA_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Data Limite (Opcional)
            </label>
            <input
              type="date"
              value={formData.dataLimite}
              onChange={(e) => setFormData({ ...formData, dataLimite: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:text-white"
            />
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Data limite para cumprimento desta etapa (opcional)
            </p>
          </div>

          <div>
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={formData.requerAnexo}
                onChange={(e) => setFormData({ ...formData, requerAnexo: e.target.checked })}
                className="form-checkbox h-4 w-4 text-indigo-600 transition duration-150 ease-in-out rounded dark:bg-gray-900 dark:border-gray-600 dark:checked:bg-indigo-600 dark:checked:border-transparent"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Requer anexo de documento
              </span>
            </label>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Se marcado, será obrigatório anexar um documento ao cumprir esta etapa
            </p>
          </div>

          <div>
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={formData.ativo}
                onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                className="form-checkbox h-4 w-4 text-indigo-600 transition duration-150 ease-in-out rounded dark:bg-gray-900 dark:border-gray-600 dark:checked:bg-indigo-600 dark:checked:border-transparent"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Etapa ativa
              </span>
            </label>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Etapas inativas não serão aplicadas a novas faturas
            </p>
          </div>

          {errors.submit && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{errors.submit}</p>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Salvando..." : "Salvar Alterações"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}




