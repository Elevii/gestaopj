# Serviços e Persistência de Dados

## Estrutura Atual

A aplicação utiliza uma camada de serviços que simula chamadas de API, persistindo dados em `localStorage` do navegador.

### Serviços

- **`projetoService.ts`** - Gerencia projetos (CRUD)
- **`atividadeService.ts`** - Gerencia atividades (CRUD)

### Contextos

- **`ProjetoContext.tsx`** - Estado global dos projetos
- **`AtividadeContext.tsx`** - Estado global das atividades

## Migração para Backend Real (NestJS + Supabase)

### Passos para migração:

1. **Substituir os serviços:**
   - Trocar chamadas para `localStorage` por chamadas HTTP usando `fetch` ou `axios`
   - Criar client HTTP ou usar biblioteca como `axios`

2. **Exemplo de como ficaria:**

```typescript
// projetoService.ts (futuro)
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ProjetoService {
  async findAll(): Promise<Projeto[]> {
    const response = await axios.get(`${API_BASE_URL}/projetos`);
    return response.data;
  }

  async create(data: CreateProjetoDTO): Promise<Projeto> {
    const response = await axios.post(`${API_BASE_URL}/projetos`, data);
    return response.data;
  }
  
  // ... outros métodos
}
```

3. **Manter a mesma interface:**
   - Os contextos continuam funcionando sem mudanças
   - As páginas continuam usando os mesmos hooks (`useProjetos`, `useAtividades`)

4. **Vantagens desta estrutura:**
   - ✅ Separação clara de responsabilidades
   - ✅ Fácil de testar
   - ✅ Migração sem quebrar código existente
   - ✅ Types compartilhados (`src/types/index.ts`)

## Estrutura de Dados

Os tipos estão definidos em `src/types/index.ts` e podem ser reutilizados no backend.

