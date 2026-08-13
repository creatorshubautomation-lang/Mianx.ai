"use client";

import { useApp, useT } from "@/lib/store";
import { LANGS } from "@/lib/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

export function LanguageSwitcher() {
  const lang = useApp((s) => s.lang);
  const setLang = useApp((s) => s.setLang);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-sm font-medium"
        >
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">
            {LANGS.find((l) => l.code === lang)?.label}
          </span>
          <span className="sm:hidden">
            {LANGS.find((l) => l.code === lang)?.flag}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {LANGS.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => setLang(l.code)}
            className={`cursor-pointer ${lang === l.code ? "bg-accent" : ""}`}
          >
            <span className="font-mono text-xs w-8">{l.flag}</span>
            <span>{l.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
