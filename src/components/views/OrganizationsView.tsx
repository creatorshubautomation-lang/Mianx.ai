"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import type { OrgSummary } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  PlusCircle,
  Users,
  Globe,
  Settings,
  Eye,
  Loader2,
  Calendar,
  ArrowRight,
  Sparkles,
  Crown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const ROLE_COLORS: Record<string, string> = {
  OWNER: "from-amber-500 to-orange-500",
  ADMIN: "from-purple-500 to-violet-500",
  MEMBER: "from-cyan-500 to-blue-500",
};

const STATUS_VARIANT: Record<string, "default" | "outline" | "secondary"> = {
  ACTIVE: "default",
  INACTIVE: "secondary",
  SUSPENDED: "outline",
};

export function OrganizationsView() {
  const { organizations, setOrganizations, setActiveOrgId, setActiveOrgPermissions, navigate } = useApp();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrgs();
  }, []);

  async function fetchOrgs() {
    setLoading(true);
    try {
      const res = await fetch("/api/organizations");
      if (res.ok) {
        const data = await res.json();
        setOrganizations(data.organizations || []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }

  async function handleViewOrg(org: OrgSummary) {
    setActiveOrgId(org.id);
    try {
      const res = await fetch(`/api/organizations/${org.id}/permissions`);
      if (res.ok) {
        const data = await res.json();
        setActiveOrgPermissions(data.permissions || []);
      }
    } catch {
      // Silently fail
    }
    navigate("dashboard");
  }

  function handleOrgSettings(org: OrgSummary) {
    setActiveOrgId(org.id);
    navigate("orgSettings", { id: org.id });
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold">
            My <span className="gradient-text">Organizations</span>
          </h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-52 glass rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">
            My <span className="gradient-text">Organizations</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your organizations, domains, and team members.
          </p>
        </div>
        <Button onClick={() => navigate("organizations")} className="btn-gradient text-white">
          <PlusCircle className="mr-2 h-4 w-4" />
          Create Organization
        </Button>
      </div>

      {/* Organizations Grid */}
      {organizations.length === 0 ? (
        <Card className="glass border-purple-500/10 overflow-hidden">
          <div className="p-8 sm:p-12 text-center">
            <div className="relative mx-auto w-32 h-32 mb-6">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 animate-pulse" />
              <div className="absolute inset-3 rounded-full bg-gradient-to-br from-purple-500/10 to-cyan-500/10" />
              <div className="absolute inset-6 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center">
                <Building2 className="h-10 w-10 text-purple-400" />
              </div>
            </div>
            <h3 className="font-bold text-xl mb-2">No Organizations Yet</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              Create your first organization to start managing domains, team members, and billing in one place.
            </p>
            <Button className="btn-gradient text-white">
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Organization
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence>
            {organizations.map((org, i) => (
              <motion.div
                key={org.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="glass border-purple-500/10 card-hover overflow-hidden">
                  <CardContent className="p-5">
                    {/* Org Header */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${ROLE_COLORS[org.userRole] || "from-purple-500 to-violet-500"}`}>
                          {org.userRole === "OWNER" ? (
                            <Crown className="h-5 w-5 text-white" />
                          ) : (
                            <Building2 className="h-5 w-5 text-white" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold truncate">{org.name}</h3>
                          <p className="text-xs text-muted-foreground truncate">
                            {org.slug}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={STATUS_VARIANT[org.status] || "outline"}
                        className="flex-shrink-0"
                      >
                        {org.status}
                      </Badge>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="text-center p-2 rounded-md bg-purple-500/5">
                        <Users className="h-4 w-4 text-purple-400 mx-auto mb-1" />
                        <div className="text-sm font-semibold">{org.memberCount}</div>
                        <div className="text-[10px] text-muted-foreground">Members</div>
                      </div>
                      <div className="text-center p-2 rounded-md bg-cyan-500/5">
                        <Globe className="h-4 w-4 text-cyan-400 mx-auto mb-1" />
                        <div className="text-sm font-semibold">{org.domainCount}</div>
                        <div className="text-[10px] text-muted-foreground">Domains</div>
                      </div>
                      <div className="text-center p-2 rounded-md bg-amber-500/5">
                        <Crown className="h-4 w-4 text-amber-400 mx-auto mb-1" />
                        <div className="text-sm font-semibold">{org.userRole}</div>
                        <div className="text-[10px] text-muted-foreground">Your Role</div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewOrg(org)}
                        className="flex-1 text-xs border-purple-500/20 hover:bg-purple-500/10"
                      >
                        <Eye className="mr-1.5 h-3 w-3" />
                        View
                        <ArrowRight className="ml-1 h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOrgSettings(org)}
                        className="flex-1 text-xs border-purple-500/20 hover:bg-purple-500/10"
                      >
                        <Settings className="mr-1.5 h-3 w-3" />
                        Settings
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setActiveOrgId(org.id);
                          navigate("dashboard");
                        }}
                        className="text-xs border-purple-500/20 hover:bg-purple-500/10"
                      >
                        <Users className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
