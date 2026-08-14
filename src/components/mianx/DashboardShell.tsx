"use client";

import { useApp, useT } from "@/lib/store";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LanguageSwitcher } from "../mianx/LanguageSwitcher";
import {
  LayoutDashboard,
  FolderKanban,
  PlusCircle,
  FileBox,
  Settings,
  Shield,
  Sparkles,
  LogOut,
  Home,
  LifeBuoy,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const t = useT();
  const { view, setView } = useApp();
  const { data: session } = useSession();

  const navItems = [
    { key: "dashboard" as const, icon: LayoutDashboard, label: t("dash.overview") },
    { key: "projects" as const, icon: FolderKanban, label: t("dash.projects") },
    { key: "newProject" as const, icon: PlusCircle, label: t("dash.newProject") },
    { key: "deliverables" as const, icon: FileBox, label: t("dash.deliverables") },
    { key: "support" as const, icon: LifeBuoy, label: "Support" },
    { key: "settings" as const, icon: Settings, label: t("dash.settings") },
  ];

  return (
    <div className="relative min-h-screen mesh-bg">
      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden lg:flex w-64 flex-shrink-0 flex-col h-screen sticky top-0 border-r border-purple-500/10 glass-strong">
          {/* Logo */}
          <button
            onClick={() => setView("home")}
            className="flex items-center gap-2 px-6 h-16 border-b border-purple-500/10"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold">
              Mianx<span className="gradient-text">.ai</span>
            </span>
          </button>

          {/* Nav */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setView(item.key)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full",
                  view === item.key
                    ? "bg-purple-500/15 text-purple-300"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}

            {session?.user?.role === "ADMIN" && (
              <>
                <div className="my-3 border-t border-purple-500/10" />
                <button
                  onClick={() => setView("admin")}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full",
                    view === "admin"
                      ? "bg-purple-500/15 text-purple-300"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent",
                  )}
                >
                  <Shield className="h-4 w-4" />
                  {t("dash.admin")}
                </button>
              </>
            )}
          </nav>

          {/* User card */}
          <div className="p-3 border-t border-purple-500/10">
            <div className="flex items-center gap-3 px-3 py-2">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-cyan-500 text-white text-sm">
                  {session?.user?.name?.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {session?.user?.name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {session?.user?.email}
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setView("home")}
                className="flex-1 text-xs"
              >
                <Home className="h-3 w-3 mr-1" />
                Home
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="text-xs text-red-400 hover:text-red-300"
              >
                <LogOut className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </aside>

        {/* Mobile top bar */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-40 glass-strong border-b border-purple-500/10">
          <div className="flex items-center justify-between px-4 h-14">
            <button
              onClick={() => setView("dashboard")}
              className="flex items-center gap-2"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-purple-500 to-cyan-500">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold">Mianx.ai</span>
            </button>
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setView("newProject")}
                className="text-xs"
              >
                <PlusCircle className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {/* Mobile nav scroll */}
          <div className="flex gap-1 px-2 pb-2 overflow-x-auto no-scrollbar">
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setView(item.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap flex-shrink-0",
                  view === item.key
                    ? "bg-purple-500/15 text-purple-300"
                    : "text-muted-foreground",
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            ))}
            {session?.user?.role === "ADMIN" && (
              <button
                onClick={() => setView("admin")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap flex-shrink-0",
                  view === "admin"
                    ? "bg-purple-500/15 text-purple-300"
                    : "text-muted-foreground",
                )}
              >
                <Shield className="h-3.5 w-3.5" />
                Admin
              </button>
            )}
          </div>
        </div>

        {/* Main content */}
        <main className="flex-1 min-w-0 pt-28 lg:pt-0">
          <div className="p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
