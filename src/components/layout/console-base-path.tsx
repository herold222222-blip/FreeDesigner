"use client";

import { createContext, useContext } from "react";

const ConsoleBasePathContext = createContext("/admin");

export function ConsoleBasePathProvider({
  basePath,
  children,
}: {
  basePath: string;
  children: React.ReactNode;
}) {
  return (
    <ConsoleBasePathContext.Provider value={basePath}>
      {children}
    </ConsoleBasePathContext.Provider>
  );
}

export function useConsoleBasePath() {
  return useContext(ConsoleBasePathContext);
}
