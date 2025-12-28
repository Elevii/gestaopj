"use client";

import { ConfiguracoesProvider } from "@/contexts/ConfiguracoesContext";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <ConfiguracoesProvider>{children}</ConfiguracoesProvider>;
}

