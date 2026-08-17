"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import type { OrgSummary } from "@/lib/store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, ChevronDown, Check, Loader2, Users, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

export function OrgSwitcher() {
  const {
    organizations,
    setOrganizations,
    activeOrgId,
    setActiveOrgId,
    setActiveOrgPermissions,
    setActiveDomainSlug,
    navigate,
  } = useApp();

  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const activeOrg = organizations.find((o) => o.id === activeOrgId) || null;

  // Fetch organizations on mount
  useEffect(() => {
    fetchOrgs();
  }, []);

  async function fetchOrgs() {
    setLoading(true);
    try {
      const res = await fetch("/api/organizations");
      if (res.ok) {
        const data = await res.json();
        const orgs: OrgSummary[] = data.organizations || [];
        setOrganizations(orgs);

        // Auto-select first org if none selected
        if (!activeOrgId && orgs.length > 0) {
          setActiveOrgId(orgs[0].id);
          await fetchPermissions(orgs[0].id);
        }
      }
    } catch {
      // Silently fail — user may not have any orgs yet
    } finally {
      setLoading(false);
    }
  }

  async function fetchPermissions(orgId: string) {
    try {
      const res = await fetch(`/api/organizations/${orgId}/permissions`);
      if (res.ok) {
        const data = await res.json();
        setActiveOrgPermissions(data.permissions || []);
      }
    } catch {
      // Silently fail
    }
  }

  async function handleSwitchOrg(org: OrgSummary) {
    setActiveOrgId(org.id);
    setActiveDomainSlug(null);
    setOpen(false);
    await fetchPermissions(org.id);
  }

  function handleCreateOrg() {
    setOpen(false);
    navigate("organizations");
  }

  // Don't render if no organizations and still loading
  if (organizations.length === 0 && loading) {
    return (
      <div className="px-3 py-2 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading organizations...</span>
      </div>
    );
  }

  // Don't render if no organizations at all
  if (organizations.length === 0) {
    return null;
  }

  return (
    <div className="px-3 pb-2">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between px-3 py-2 h-auto border-purple-500/20 hover:bg-purple-500/10 hover:border-purple-500/30"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-purple-500 to-cyan-500 flex-shrink-0">
                <Building2 className="h-3.5 w-3.5 text-white" />
              </div>
              <div className="flex flex-col items-start min-w-0">
                <span className="text-sm font-medium truncate w-full">
                  {activeOrg?.name || "Select Organization"}
                </span>
                {activeOrg && (
                  <span className="text-[10px] text-muted-foreground truncate w-full">
                    {activeOrg.memberCount} members
                  </span>
                )}
              </div>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-[280px] glass border-purple-500/20"
        >
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
            Switch Organization
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-purple-500/10" />
          {organizations.map((org) => (
            <DropdownMenuItem
              key={org.id}
              onClick={() => handleSwitchOrg(org)}
              className={cn(
                "flex items-center gap-3 py-2.5 cursor-pointer",
                activeOrgId === org.id && "bg-purple-500/10",
              )}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex-shrink-0">
                <Building2 className="h-4 w-4 text-purple-400" />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-medium truncate">
                  {org.name}
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Users className="h-3 w-3" />
                    {org.memberCount}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Globe className="h-3 w-3" />
                    {org.domainCount}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 h-5 border-purple-500/20"
                >
                  {org.userRole}
                </Badge>
                {activeOrgId === org.id && (
                  <Check className="h-4 w-4 text-purple-400" />
                )}
              </div>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator className="bg-purple-500/10" />
          <DropdownMenuItem
            onClick={handleCreateOrg}
            className="flex items-center gap-3 py-2.5 text-purple-400 cursor-pointer"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-purple-500/10 flex-shrink-0">
              <Plus className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium">Create Organization</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
