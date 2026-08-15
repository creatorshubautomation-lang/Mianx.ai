"use client";

import { ThemeProvider as NextThemesProvider, type Attribute } from "next-themes";
import type { ReactNode } from "react";

export function ThemeProvider({
  children,
  ...props
}: {
  children: ReactNode;
  attribute: Attribute;
  defaultTheme: string;
  enableSystem: boolean;
  disableTransitionOnChange: boolean;
}) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
