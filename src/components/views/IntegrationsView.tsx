"use client";

import { useEffect, useState, useMemo } from "react";
import { useApp } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plug,
  PlusCircle,
  Search,
  RefreshCw,
  Settings,
  Unplug,
  Github,
  Slack,
  Database,
  Mail,
  Cloud,
  FileText,
  Globe,
  ShieldCheck,
} from "lucide-react";
import { motion } from "framer-motion";

type IntegrationStatus = "CONNECTED" | "DEGRADED" | "REAUTH_REQUIRED" | "DISABLED";

interface Integration {
  id: string;
  provider: string;
  status: IntegrationStatus;
  lastSync: string | null;
  icon: string;
  description: string;
  connectedAt: string;
}

const STATUS_STYLES: Record<IntegrationStatus, string> = {
  CONNECTED: "bg-green-500/20 text-green-300 border-green-500/30",
  DEGRADED: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  REAUTH_REQUIRED: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  DISABLED: "bg-red-500/20 text-red-300 border-red-500/30",
};

const PROVIDER_ICONS: Record<string, React.ElementType> = {
  github: Github,
  slack: Slack,
  database: Database,
  mail: Mail,
  cloud: Cloud,
  filetext: FileText,
  globe: Globe,
  shield: ShieldCheck,
};

const PROVIDER_COLORS: Record<string, string> = {
  github: "from-gray-400 to-gray-600",
  slack: "from-purple-400 to-pink-500",
  database: "from-cyan-400 to-blue-500",
  mail: "from-amber-400 to-orange-500",
  cloud: "from-blue-400 to-indigo-500",
  filetext: "from-green-400 to-emerald-500",
  globe: "from-teal-400 to-cyan-500",
  shield: "from-red-400 to-rose-500",
};

const PLACEHOLDER_INTEGRATIONS: Integration[] = [
  {
    id: "int-001",
    provider: "GitHub",
    status: "CONNECTED",
    lastSync: "2025-01-10T15:30:00Z",
    icon: "github",
    description: "Source code management and CI/CD triggers",
    connectedAt: "2024-08-15T10:00:00Z",
  },
  {
    id: "int-002",
    provider: "Slack",
    status: "CONNECTED",
    lastSync: "2025-01-10T14:45:00Z",
    icon: "slack",
    description: "Team communication and notification delivery",
    connectedAt: "2024-09-20T12:30:00Z",
  },
  {
    id: "int-003",
    provider: "PostgreSQL",
    status: "DEGRADED",
    lastSync: "2025-01-10T10:15:00Z",
    icon: "database",
    description: "Primary data store for application data",
    connectedAt: "2024-07-10T09:00:00Z",
  },
  {
    id: "int-004",
    provider: "SendGrid",
    status: "REAUTH_REQUIRED",
    lastSync: "2024-12-28T08:00:00Z",
    icon: "mail",
    description: "Transactional email delivery service",
    connectedAt: "2024-06-01T11:00:00Z",
  },
  {
    id: "int-005",
    provider: "AWS S3",
    status: "CONNECTED",
    lastSync: "2025-01-10T13:20:00Z",
    icon: "cloud",
    description: "Object storage for file uploads and assets",
    connectedAt: "2024-10-05T14:00:00Z",
  },
  {
    id: "int-006",
    provider: "Notion",
    status: "DISABLED",
    lastSync: "2024-11-15T16:00:00Z",
    icon: "filetext",
    description: "Knowledge base and documentation sync",
    connectedAt: "2024-09-01T10:00:00Z",
  },
];

export function IntegrationsView() {
  const { activeOrgId } = useApp();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [syncingId, setSyncingId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeOrgId) return;
    fetch(`/api/organizations/${activeOrgId}/integrations`)
      .then((r) => r.json())
      .then((data) => {
        setIntegrations(
          data.integrations?.length
            ? data.integrations
            : PLACEHOLDER_INTEGRATIONS,
        );
        setLoading(false);
      })
      .catch(() => {
        setIntegrations(PLACEHOLDER_INTEGRATIONS);
        setLoading(false);
      });
  }, [activeOrgId]);

  const filtered = useMemo(() => {
    let result = integrations;
    if (statusFilter !== "all") {
      result = result.filter((i) => i.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (i) =>
          i.provider.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q),
      );
    }
    return result;
  }, [integrations, statusFilter, searchQuery]);

  const handleSync = (id: string) => {
    setSyncingId(id);
    setTimeout(() => {
      setIntegrations((prev) =>
        prev.map((i) =>
          i.id === id
            ? { ...i, lastSync: new Date().toISOString() }
            : i,
        ),
      );
      setSyncingId(null);
    }, 1500);
  };

  const handleDisconnect = (id: string) => {
    setIntegrations((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, status: "DISABLED" as IntegrationStatus } : i,
      ),
    );
  };

  if (!activeOrgId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">
            <span className="gradient-text">Integrations</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Select an organization to manage integrations.
          </p>
        </div>
        <Card className="glass border-purple-500/10 p-8 text-center">
          <Plug className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-bold text-lg mb-2">No Organization Selected</h3>
          <p className="text-sm text-muted-foreground">
            Please select an organization from the switcher to view and manage
            integrations.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">
            <span className="gradient-text">Integrations</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect and manage external services for your organization.
          </p>
        </div>
        <Button className="btn-gradient text-white">
          <PlusCircle className="mr-2 h-4 w-4" />
          Connect Integration
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search integrations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-purple-500/5 border-purple-500/10 focus:border-purple-500/30"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48 bg-purple-500/5 border-purple-500/10">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent className="glass border-purple-500/20">
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="CONNECTED">Connected</SelectItem>
            <SelectItem value="DEGRADED">Degraded</SelectItem>
            <SelectItem value="REAUTH_REQUIRED">Reauth Required</SelectItem>
            <SelectItem value="DISABLED">Disabled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="glass border-purple-500/10 p-5">
              <div className="flex items-center gap-3 mb-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-24 mb-1" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <Skeleton className="h-3 w-full mb-3" />
              <Skeleton className="h-3 w-32 mb-4" />
              <div className="flex gap-2">
                <Skeleton className="h-8 flex-1" />
                <Skeleton className="h-8 flex-1" />
                <Skeleton className="h-8 flex-1" />
              </div>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="glass border-purple-500/10 p-8 sm:p-12 text-center">
          <div className="relative mx-auto w-28 h-28 mb-6">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 animate-pulse" />
            <div className="absolute inset-4 rounded-full bg-gradient-to-br from-purple-500/10 to-cyan-500/10" />
            <div className="absolute inset-8 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center">
              <Plug className="h-8 w-8 text-purple-400" />
            </div>
          </div>
          <h3 className="font-bold text-xl mb-2">No Integrations Connected Yet</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
            {searchQuery || statusFilter !== "all"
              ? "No integrations match your current filters. Try adjusting your search criteria."
              : "Connect your first integration to extend your organization's capabilities and automate workflows."}
          </p>
          {!searchQuery && statusFilter === "all" && (
            <Button className="btn-gradient text-white">
              <PlusCircle className="mr-2 h-4 w-4" />
              Connect Integration
            </Button>
          )}
        </Card>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {filtered.map((integration, index) => {
            const IconComponent =
              PROVIDER_ICONS[integration.icon.toLowerCase()] || Globe;
            const colorClass =
              PROVIDER_COLORS[integration.icon.toLowerCase()] ||
              "from-purple-400 to-cyan-500";

            return (
              <motion.div
                key={integration.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="glass border-purple-500/10 p-5 card-hover h-full flex flex-col">
                  {/* Provider Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${colorClass} flex-shrink-0`}
                      >
                        <IconComponent className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm">
                          {integration.provider}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Connected{" "}
                          {new Date(
                            integration.connectedAt,
                          ).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] flex-shrink-0 ${STATUS_STYLES[integration.status]}`}
                    >
                      {integration.status === "REAUTH_REQUIRED"
                        ? "Reauth"
                        : integration.status.charAt(0) +
                          integration.status.slice(1).toLowerCase()}
                    </Badge>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-muted-foreground mb-3 flex-1">
                    {integration.description}
                  </p>

                  {/* Last Sync */}
                  <p className="text-[11px] text-muted-foreground mb-4">
                    Last sync: {" "}
                    {integration.lastSync
                      ? new Date(integration.lastSync).toLocaleString()
                      : "Never"}
                  </p>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 text-xs border-purple-500/20 hover:bg-purple-500/10 text-green-400 hover:text-green-300"
                      disabled={syncingId === integration.id}
                      onClick={() => handleSync(integration.id)}
                    >
                      <RefreshCw
                        className={`mr-1.5 h-3 w-3 ${syncingId === integration.id ? "animate-spin" : ""}`}
                      />
                      {syncingId === integration.id ? "Syncing..." : "Sync Now"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 text-xs border-purple-500/20 hover:bg-purple-500/10"
                    >
                      <Settings className="mr-1.5 h-3 w-3" />
                      Settings
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0 border-purple-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20"
                      onClick={() => handleDisconnect(integration.id)}
                    >
                      <Unplug className="h-3 w-3" />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
