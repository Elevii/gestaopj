# ATUAPJ - Projeto Fullstack

Monorepo contendo frontend (Next.js) e backend (NestJS).

## 📋 Pré-requisitos

- Node.js LTS (versão 18 ou superior)
- npm ou yarn

## 🚀 Como executar

### Frontend (Next.js)

1. Entre na pasta do frontend:
```bash
cd atuapj-front
```

2. Instale as dependências (apenas na primeira vez):
```bash
npm install
```

3. Execute o servidor de desenvolvimento:
```bash
npm run dev
```

O frontend estará disponível em: http://localhost:3000

### Backend (NestJS)

1. Entre na pasta do backend:
```bash
cd atuapj-api
```

2. Instale as dependências (apenas na primeira vez):
```bash
npm install
```

3. Execute o servidor de desenvolvimento:
```bash
npm run start:dev
```

O backend estará disponível em: http://localhost:3001

4. Teste o endpoint de health:
```bash
curl http://localhost:3001/health
```

Resposta esperada:
```json
{
  "status": "ok"
}
```

## 📁 Estrutura do Projeto

```
atuapj/
├── atuapj-front/     # Frontend Next.js
│   ├── src/
│   │   └── app/      # App Router
│   ├── .env.local    # Variáveis de ambiente
│   └── package.json
│
└── atuapj-api/       # Backend NestJS
    ├── src/
    │   ├── main.ts
    │   ├── app.module.ts
    │   └── app.controller.ts
    ├── .env          # Variáveis de ambiente
    └── package.json
```

## 🛠️ Tecnologias

### Frontend
- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- ESLint
- Prettier

### Backend
- NestJS 10
- TypeScript
- Express
- CORS habilitado

## 📝 Scripts Disponíveis

### Frontend
- `npm run dev` - Inicia o servidor de desenvolvimento
- `npm run build` - Cria build de produção
- `npm run start` - Inicia o servidor de produção
- `npm run lint` - Executa o ESLint

### Backend
- `npm run start:dev` - Inicia o servidor de desenvolvimento com watch mode
- `npm run build` - Compila o projeto
- `npm run start` - Inicia o servidor de produção
- `npm run lint` - Executa o ESLint
- `npm run format` - Formata o código com Prettier

## 🔧 Configuração

### Variáveis de Ambiente

**Frontend** (`.env.local`):
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

**Backend** (`.env`):
```
PORT=3001
```

## 📌 Observações

- O projeto está configurado para desenvolvimento local
- CORS está habilitado no backend para aceitar requisições do frontend
- Ambos os projetos usam TypeScript
- Código formatado com Prettier e validado com ESLint

