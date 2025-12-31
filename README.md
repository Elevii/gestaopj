# ATUAPJ - Projeto Fullstack

Monorepo contendo frontend (Next.js) e backend (NestJS).

## 📋 Pré-requisitos

- Node.js LTS (versão 18 ou superior)
- npm ou yarn

## 🚀 Como executar

### Frontend (Next.js)

1. Entre na pasta do frontend:
```bash
cd gestaopj-front
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
cd gestaopj-api
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
gestaopj/
├── gestaopj-front/     # Frontend Next.js
│   ├── src/
│   │   └── app/      # App Router
│   ├── .env.local    # Variáveis de ambiente
│   └── package.json
│
└── gestaopj-api/       # Backend NestJS
    ├── src/
    │   ├── main.ts
    │   ├── app.module.ts
    │   ├── auth/     # Módulo de autenticação
    │   ├── users/    # Módulo de usuários
    │   └── prisma/   # Prisma service
    ├── prisma/
    │   └── schema.prisma  # Schema do banco de dados
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
- Prisma ORM
- PostgreSQL
- JWT Authentication
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
- `npm run prisma:generate` - Gera o Prisma Client
- `npm run prisma:migrate` - Executa migrações do banco de dados
- `npm run prisma:studio` - Abre o Prisma Studio (interface visual do banco)

## 🔧 Configuração

### Variáveis de Ambiente

**Frontend** (`.env.local`):
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

**Backend** (`.env`):
```
DATABASE_URL="postgresql://user:password@localhost:5432/gestaopj"
JWT_SECRET="change-this-to-a-secure-random-string-in-production"
JWT_EXPIRES_IN="7d"
PORT=3001
NODE_ENV=development
FRONTEND_URL="http://localhost:3000"
```

### Setup do Banco de Dados

1. Instale o PostgreSQL localmente ou use Docker
2. Crie um banco de dados chamado `gestaopj`
3. Copie `ENV.example` para `.env` no diretório `gestaopj-api` e configure as variáveis
4. Execute as migrações:
```bash
cd gestaopj-api
npm run prisma:migrate
```
5. (Opcional) Para visualizar o banco: `npm run prisma:studio`

## 🔐 Autenticação

A autenticação está integrada entre frontend e backend:

- **Cadastro**: `POST /auth/register` - Cria novo usuário e retorna token JWT
- **Login**: `POST /auth/login` - Autentica usuário e retorna token JWT
- Tokens JWT são armazenados no localStorage do frontend
- Tokens expiram em 7 dias (configurável via `JWT_EXPIRES_IN`)

## 📌 Observações

- O projeto está configurado para desenvolvimento local
- CORS está habilitado no backend para aceitar requisições do frontend
- Ambos os projetos usam TypeScript
- Código formatado com Prettier e validado com ESLint
- **Importante**: Configure as variáveis de ambiente antes de executar o projeto
- Certifique-se de que o PostgreSQL está rodando antes de iniciar o backend

