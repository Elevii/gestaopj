"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { companyService } from "@/services/companyService";
import { companyMembershipService } from "@/services/companyMembershipService";
import { subscriptionService } from "@/services/subscriptionService";
import { authService } from "@/services/authService";

export default function CriarEmpresaPage() {
  const router = useRouter();
  const {
    user,
    refreshAuth,
    switchCompany,
    userCompanies,
    company,
    loading,
    isAuthenticated,
  } = useAuth();
  const [formData, setFormData] = useState({
    nomeEmpresa: "",
    cnpj: "",
    email: "",
    phone: "",
    address: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    nomeEmpresa?: string;
    [key: string]: string | undefined;
  }>({});

  // Verificar se usuário já tem empresas e redirecionar para dashboard
  useEffect(() => {
    const checkAndRedirect = async () => {
      if (loading || !isAuthenticated || !user) return;

      // Se já tem empresas, redirecionar para dashboard
      if (userCompanies.length > 0) {
        // Se não tem empresa selecionada, selecionar a primeira
        if (!company) {
          try {
            await authService.switchCompany(userCompanies[0].companyId);
            await refreshAuth();
            await new Promise((resolve) => setTimeout(resolve, 100));
          } catch (error) {
            console.error("Erro ao selecionar empresa:", error);
          }
        }
        // Redirecionar para dashboard
        router.push("/dashboard");
      }
    };

    checkAndRedirect();
  }, [
    loading,
    isAuthenticated,
    user,
    userCompanies.length,
    company,
    refreshAuth,
  ]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});

    // Validação
    const newErrors: { nomeEmpresa?: string } = {};

    if (!formData.nomeEmpresa.trim()) {
      newErrors.nomeEmpresa = "Nome da empresa é obrigatório";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (!user) {
      setErrors({ nomeEmpresa: "Usuário não autenticado" });
      return;
    }

    setIsLoading(true);
    try {
      // 1. Criar empresa
      const empresa = await companyService.create({
        name: formData.nomeEmpresa,
        cnpj: formData.cnpj || undefined,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        address: formData.address || undefined,
      });

      // 2. Criar membership com role OWNER
      await companyMembershipService.create({
        userId: user.id,
        companyId: empresa.id,
        role: "owner",
      });

      // 3. Criar assinatura padrão (plano gratuito)
      const planFree = await subscriptionService.getPlanBySlug("free");
      if (planFree) {
        await subscriptionService.create({
          companyId: empresa.id,
          planId: planFree.id,
          status: "active",
        });
      }

      // 4. Selecionar empresa criada e atualizar autenticação
      // Usar authService diretamente para garantir que a sessão está disponível
      await authService.switchCompany(empresa.id);
      await refreshAuth();

      // Aguardar um pouco para garantir que o estado seja atualizado
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Redirecionar para dashboard
      router.push("/dashboard");
    } catch (error: any) {
      console.error("Erro ao criar empresa:", error);
      setErrors({
        nomeEmpresa: error.message || "Erro ao criar empresa. Tente novamente.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <Link
              href="/onboarding"
              className="inline-flex items-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 mb-4"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Voltar
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Criar Nova Empresa
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Preencha os dados da sua empresa para começar
            </p>
          </div>

          {/* Form */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Nome da Empresa */}
              <div>
                <label
                  htmlFor="nomeEmpresa"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Nome da Empresa <span className="text-red-500">*</span>
                </label>
                <input
                  id="nomeEmpresa"
                  name="nomeEmpresa"
                  type="text"
                  required
                  value={formData.nomeEmpresa}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                    errors.nomeEmpresa
                      ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                      : "border-gray-300"
                  }`}
                  placeholder="Ex: Minha Empresa LTDA"
                />
                {errors.nomeEmpresa && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {errors.nomeEmpresa}
                  </p>
                )}
              </div>

              {/* CNPJ */}
              <div>
                <label
                  htmlFor="cnpj"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  CNPJ (opcional)
                </label>
                <input
                  id="cnpj"
                  name="cnpj"
                  type="text"
                  value={formData.cnpj}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="00.000.000/0000-00"
                />
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Email (opcional)
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="contato@empresa.com"
                />
              </div>

              {/* Telefone */}
              <div>
                <label
                  htmlFor="phone"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Telefone (opcional)
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="(00) 00000-0000"
                />
              </div>

              {/* Endereço */}
              <div>
                <label
                  htmlFor="address"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Endereço (opcional)
                </label>
                <textarea
                  id="address"
                  name="address"
                  rows={3}
                  value={formData.address}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="Rua, número, bairro, cidade - UF"
                />
              </div>

              {/* Submit Button */}
              <div className="flex gap-4">
                <Link
                  href="/onboarding"
                  className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-center"
                >
                  Cancelar
                </Link>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? "Criando..." : "Criar Empresa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
