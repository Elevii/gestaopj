const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Log sempre para debug
if (typeof window !== 'undefined') {
  console.log('🔗 API Base URL configurada:', API_BASE_URL);
  console.log('🔗 NEXT_PUBLIC_API_URL da env:', process.env.NEXT_PUBLIC_API_URL || 'NÃO DEFINIDA');
  if (!process.env.NEXT_PUBLIC_API_URL) {
    console.error('❌ ERRO: NEXT_PUBLIC_API_URL não está configurada! Configure no Vercel ou .env.local');
    console.error('❌ Usando fallback localhost (não funcionará em produção):', API_BASE_URL);
  }
}

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    if (typeof window !== 'undefined') {
      console.log('📡 ApiClient inicializado com baseURL:', this.baseURL);
    }
  }

  private getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('gestaopj_access_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const token = this.getAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      // Se receber 401 Unauthorized, limpar tokens e redirecionar para login
      if (response.status === 401) {
        if (typeof window !== 'undefined') {
          console.log('❌ Token inválido ou expirado - fazendo logout');
          localStorage.removeItem('gestaopj_access_token');
          localStorage.removeItem('gestaopj_session');
          localStorage.removeItem('gestaopj_current_user');
          localStorage.removeItem('gestaopj_current_company');
          
          // Redirecionar para login apenas se não estiver já na página de login
          if (!window.location.pathname.includes('/login') && 
              !window.location.pathname.includes('/cadastro')) {
            window.location.href = '/login';
          }
        }
      }
      
      const errorData = await response.json().catch(() => ({
        message: response.statusText || 'Erro na requisição',
      }));
      throw new Error(errorData.message || `Erro ${response.status}`);
    }

    return response.json();
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  setAuthToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('gestaopj_access_token', token);
    }
  }

  clearAuthToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('gestaopj_access_token');
    }
  }
}

export const api = new ApiClient(API_BASE_URL);

