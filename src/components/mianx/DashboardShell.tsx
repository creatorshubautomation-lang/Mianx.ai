"use client";

import { useApp, useT } from "@/lib/store";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LanguageSwitcher } from "../mianx/LanguageSwitcher";
import { NotificationBell } from "../mianx/NotificationBell";
import { OrgSwitcher } from "../mianx/OrgSwitcher";
import { DomainNav } from "../mianx/DomainNav";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
  Search,
  Command,
  Rocket,
  Wrench,
  ShieldCheck,
  Activity,
  Wallet,
  Store,
  ChartBar,
  Building2,
  CreditCard,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const t = useT();
  const { view, navigate, activeOrgId } = useApp();
  const { data: session } = useSession();

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isNewUser, setIsNewUser] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Check if user is new (first-time)
  useEffect(() => {
    const onboarded = localStorage.getItem("mianx_onboarded");
    setIsNewUser(!onboarded);
  }, []);

  // Focus search input when dialog opens
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [searchOpen]);

  const navItems = [
    { key: "dashboard" as const, icon: LayoutDashboard, label: t("dash.overview") },
    { key: "projects" as const, icon: FolderKanban, label: t("dash.projects") },
    { key: "newProject" as const, icon: PlusCircle, label: t("dash.newProject") },
    { key: "deliverables" as const, icon: FileBox, label: t("dash.deliverables") },
    { key: "missions" as const, icon: Rocket, label: "Missions" },
    { key: "commandCenter" as const, icon: Activity, label: "Command Center" },
    { key: "toolRegistry" as const, icon: Wrench, label: "Tools" },
    { key: "approvals" as const, icon: ShieldCheck, label: "Approvals" },
    { key: "budget" as const, icon: Wallet, label: "Budget" },
    { key: "trustCenter" as const, icon: Shield, label: "Trust Center" },
    { key: "agentPerformance" as const, icon: ChartBar, label: "Agent Analytics" },
    { key: "marketplace" as const, icon: Store, label: "Marketplace" },
    { key: "support" as const, icon: LifeBuoy, label: "Support" },
    { key: "settings" as const, icon: Settings, label: t("dash.settings") },
    { key: "organizations" as const, icon: Building2, label: "Organizations" },
    { key: "billing" as const, icon: CreditCard, label: "Billing" },
  ];

  const allNavItems = session?.user?.role === "ADMIN"
    ? [...navItems, { key: "admin" as const, icon: Shield, label: t("dash.admin") }]
    : navItems;

  const filteredNavItems = searchQuery
    ? allNavItems.filter((item) =>
        item.label.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : allNavItems;

  const handleNavClick = (key: string) => {
    navigate(key as "dashboard" | "projects" | "newProject" | "deliverables" | "missions" | "missionDetail" | "commandCenter" | "toolRegistry" | "approvals" | "budget" | "trustCenter" | "agentPerformance" | "marketplace" | "support" | "settings" | "organizations" | "billing" | "admin");
    setSearchOpen(false);
    setSearchQuery("");
  };

  return (
    <div className="relative min-h-screen mesh-bg">
      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden lg:flex w-64 flex-shrink-0 flex-col h-screen sticky top-0 border-r border-purple-500/10 glass-strong">
          {/* Logo */}
          <button
            onClick={() => navigate("home")}
            title="Go to homepage"
            className="flex items-center gap-2 px-6 h-16 border-b border-purple-500/10"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold">
              Mianx<span className="gradient-text">.ai</span>
            </span>
          </button>

          {/* Org Switcher */}
          <OrgSwitcher />

          {/* Search / Command Palette Button */}
          <div className="px-3 pt-3 pb-1">
            <button
              onClick={() => setSearchOpen(true)}
              title="Search navigation (Ctrl+K)"
              className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors border border-purple-500/10"
            >
              <Search className="h-4 w-4" />
              <span className="flex-1 text-left">Search...</span>
              <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-purple-500/20 bg-purple-500/5 px-1.5 font-mono text-[10px] text-muted-foreground">
                <Command className="h-3 w-3" />K
              </kbd>
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-3 pt-1 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              // Hide org-dependent items if no org is selected
              if (!activeOrgId && item.key === "billing") return null;

              return (
              <button
                key={item.key}
                onClick={() => navigate(item.key)}
                title={item.label}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full",
                  view === item.key
                    ? "bg-purple-500/15 text-purple-300"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent",
                )}
              >
                <item.icon className="h-4 w-4" />
                <span className="flex-1 text-left">{item.label}</span>
                {item.key === "dashboard" && isNewUser && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gradient-to-r from-purple-500 to-cyan-500 text-white animate-pulse">
                    New here?
                  </span>
                )}
              </button>
            );
            })}

            {/* Domain Navigation (shows below main nav if org is active) */}
            <DomainNav />

            {session?.user?.role === "ADMIN" && (
              <>
                <div className="my-3 border-t border-purple-500/10" />
                <button
                  onClick={() => navigate("admin")}
                  title={t("dash.admin")}
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
          <div className="p-3 border-t border-purple-500/10 flex-shrink-0">
            <div className="flex items-center gap-3 px-3 py-2">
              <NotificationBell />
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
                onClick={() => navigate("home")}
                title="Go to homepage"
                className="flex-1 text-xs"
              >
                <Home className="h-3 w-3 mr-1" />
                Home
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut({ callbackUrl: "/" })}
                title="Sign out"
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
              onClick={() => navigate("dashboard")}
              title="Go to dashboard"
              className="flex items-center gap-2"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-purple-500 to-cyan-500">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold">Mianx.ai</span>
            </button>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <LanguageSwitcher />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchOpen(true)}
                title="Search"
                className="text-xs"
              >
                <Search className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("newProject")}
                title="Create new project"
                className="text-xs"
              >
                <PlusCircle className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {/* Mobile nav scroll */}
          <div className="flex gap-2 px-3 pb-3 overflow-x-auto no-scrollbar">
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => navigate(item.key)}
                title={item.label}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors",
                  view === item.key
                    ? "bg-purple-500/15 text-purple-300"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
                {item.key === "dashboard" && isNewUser && (
                  <span className="inline-flex h-2 w-2 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 animate-pulse" />
                )}
              </button>
            ))}
            {session?.user?.role === "ADMIN" && (
              <button
                onClick={() => navigate("admin")}
                title="Admin"
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors",
                  view === "admin"
                    ? "bg-purple-500/15 text-purple-300"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Shield className="h-3.5 w-3.5" />
                Admin
              </button>
            )}
          </div>
        </div>

        {/* Mobile sticky bottom nav */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 backdrop-blur-xl bg-background/80 border-t border-purple-500/10 pb-[env(safe-area-inset-bottom)]">
          <div className="flex items-center justify-around px-2 py-2">
            {navItems.slice(0, 5).map((item) => (
              <button
                key={item.key}
                onClick={() => navigate(item.key)}
                title={item.label}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors",
                  view === item.key
                    ? "text-purple-300"
                    : "text-muted-foreground",
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main content */}
        <main className="flex-1 min-w-0 pt-28 lg:pt-0 pb-20 lg:pb-0">
          <div className="p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>

      {/* Search / Command Palette Dialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="glass border-purple-500/20 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-4 w-4 text-purple-400" />
              Search Navigation
            </DialogTitle>
            <DialogDescription>
              Quick-jump to any page in your dashboard.
            </DialogDescription>
          </DialogHeader>
          <Input
            ref={searchInputRef}
            placeholder="Type to search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-purple-500/5 border-purple-500/20"
          />
          <div className="max-h-64 overflow-y-auto space-y-1">
            {filteredNavItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No results found for &quot;{searchQuery}&quot;
              </p>
            ) : (
              filteredNavItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => handleNavClick(item.key)}
                  className={cn(
                    "flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm transition-colors",
                    view === item.key
                      ? "bg-purple-500/15 text-purple-300"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                  {item.key === "dashboard" && isNewUser && (
                    <span className="ml-auto inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gradient-to-r from-purple-500 to-cyan-500 text-white">
                      Recommended
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
