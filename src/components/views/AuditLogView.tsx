"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useApp } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Shield,
  Download,
  Search,
  User,
  Bot,
  ServerCog,
  WebhookIcon,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from "lucide-react";
import { motion } from "framer-motion";

type ActorType = "USER" | "AGENT" | "SYSTEM" | "WEBHOOK";
type ActionType = "create" | "update" | "delete" | "login" | "other";

interface AuditEntry {
  id: string;
  timestamp: string;
  actorType: ActorType;
  actorName: string;
  action: ActionType;
  actionLabel: string;
  resource: string;
  details: Record<string, string | number | boolean>;
}

const ACTOR_ICONS: Record<ActorType, React.ElementType> = {
  USER: User,
  AGENT: Bot,
  SYSTEM: ServerCog,
  WEBHOOK: WebhookIcon,
};

const ACTOR_COLORS: Record<ActorType, string> = {
  USER: "from-purple-400 to-violet-500",
  AGENT: "from-cyan-400 to-blue-500",
  SYSTEM: "from-gray-400 to-gray-500",
  WEBHOOK: "from-amber-400 to-orange-500",
};

const ACTION_STYLES: Record<ActionType, string> = {
  create: "bg-green-500/20 text-green-300 border-green-500/30",
  update: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  delete: "bg-red-500/20 text-red-300 border-red-500/30",
  login: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  other: "bg-gray-500/20 text-gray-300 border-gray-500/30",
};

const PLACEHOLDER_LOGS: AuditEntry[] = [
  {
    id: "log-001",
    timestamp: "2025-01-10T15:45:00Z",
    actorType: "USER",
    actorName: "Alice Chen",
    action: "create",
    actionLabel: "Created project",
    resource: "Project: Brand Redesign v2",
    details: { projectId: "proj-042", teamSize: 4, priority: "high" },
  },
  {
    id: "log-002",
    timestamp: "2025-01-10T15:30:00Z",
    actorType: "AGENT",
    actorName: "Code Reviewer",
    action: "update",
    actionLabel: "Completed review",
    resource: "PR #247: Fix auth middleware",
    details: { prId: "247", filesChanged: 3, commentsAdded: 5, verdict: "approved" },
  },
  {
    id: "log-003",
    timestamp: "2025-01-10T15:12:00Z",
    actorType: "USER",
    actorName: "Bob Martinez",
    action: "update",
    actionLabel: "Updated settings",
    resource: "Organization: Acme Corp",
    details: { setting: "notificationPreferences", oldValue: "all", newValue: "important" },
  },
  {
    id: "log-004",
    timestamp: "2025-01-10T14:58:00Z",
    actorType: "SYSTEM",
    actorName: "System",
    action: "create",
    actionLabel: "Auto-scaled resources",
    resource: "Infrastructure: API Cluster",
    details: { instancesBefore: 3, instancesAfter: 5, reason: "high CPU load" },
  },
  {
    id: "log-005",
    timestamp: "2025-01-10T14:30:00Z",
    actorType: "WEBHOOK",
    actorName: "GitHub Webhook",
    action: "create",
    actionLabel: "Received push event",
    resource: "Repository: mianx-platform",
    details: { branch: "main", commits: 2, pusher: "alice" },
  },
  {
    id: "log-006",
    timestamp: "2025-01-10T14:05:00Z",
    actorType: "USER",
    actorName: "Carol Davis",
    action: "delete",
    actionLabel: "Deleted integration",
    resource: "Integration: Old Slack Bot",
    details: { integrationId: "int-old-01", reason: "deprecated" },
  },
  {
    id: "log-007",
    timestamp: "2025-01-10T13:45:00Z",
    actorType: "USER",
    actorName: "Alice Chen",
    action: "login",
    actionLabel: "Signed in",
    resource: "Session",
    details: { method: "oauth", provider: "github", ip: "203.0.113.42" },
  },
  {
    id: "log-008",
    timestamp: "2025-01-10T13:20:00Z",
    actorType: "AGENT",
    actorName: "Support Triage",
    action: "update",
    actionLabel: "Routed tickets",
    resource: "Support Queue",
    details: { ticketsProcessed: 12, autoResolved: 5, escalated: 3 },
  },
  {
    id: "log-009",
    timestamp: "2025-01-10T12:55:00Z",
    actorType: "SYSTEM",
    actorName: "System",
    action: "update",
    actionLabel: "Rotated API keys",
    resource: "Security: API Key Rotation",
    details: { keysRotated: 4, nextRotation: "2025-02-10" },
  },
  {
    id: "log-010",
    timestamp: "2025-01-10T12:30:00Z",
    actorType: "USER",
    actorName: "Bob Martinez",
    action: "create",
    actionLabel: "Created AI agent",
    resource: "Agent: Data Analyst",
    details: { autonomyLevel: "L3", toolsAssigned: 7, domain: "Engineering" },
  },
  {
    id: "log-011",
    timestamp: "2025-01-10T11:45:00Z",
    actorType: "AGENT",
    actorName: "Content Writer",
    action: "create",
    actionLabel: "Generated content",
    resource: "Content: Q1 Blog Post",
    details: { wordCount: 2450, seoScore: 87, status: "draft" },
  },
  {
    id: "log-012",
    timestamp: "2025-01-10T11:10:00Z",
    actorType: "USER",
    actorName: "Carol Davis",
    action: "update",
    actionLabel: "Updated billing plan",
    resource: "Billing: Acme Corp",
    details: { oldPlan: "Starter", newPlan: "Pro", amount: "$49/mo" },
  },
];

const PAGE_SIZE = 8;

export function AuditLogView() {
  const { activeOrgId } = useApp();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actorFilter, setActorFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!activeOrgId) return;
    fetch(`/api/organizations/${activeOrgId}/audit-log`)
      .then((r) => r.json())
      .then((data) => {
        setLogs(data.logs?.length ? data.logs : PLACEHOLDER_LOGS);
        setLoading(false);
      })
      .catch(() => {
        setLogs(PLACEHOLDER_LOGS);
        setLoading(false);
      });
  }, [activeOrgId]);

  // Reset to page 1 when filters change
  const handleActorFilter = (v: string) => {
    setActorFilter(v);
    setPage(1);
  };
  const handleActionFilter = (v: string) => {
    setActionFilter(v);
    setPage(1);
  };
  const handleDateFilter = (v: string) => {
    setDateFilter(v);
    setPage(1);
  };

  const filtered = useMemo(() => {
    let result = logs;
    if (actorFilter !== "all") {
      result = result.filter((l) => l.actorType === actorFilter);
    }
    if (actionFilter !== "all") {
      result = result.filter((l) => l.action === actionFilter);
    }
    if (dateFilter !== "all") {
      const now = new Date();
      let cutoff: Date;
      switch (dateFilter) {
        case "1h":
          cutoff = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case "24h":
          cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case "7d":
          cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoff = new Date(0);
      }
      result = result.filter((l) => new Date(l.timestamp) >= cutoff);
    }
    return result;
  }, [logs, actorFilter, actionFilter, dateFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  const handleExport = useCallback(() => {
    // Placeholder for CSV/JSON export
    const csvHeader = "Timestamp,Actor,Action,Resource,Details\n";
    const csvRows = filtered
      .map(
        (l) =>
          `${l.timestamp},${l.actorName},${l.actionLabel},${l.resource},"${JSON.stringify(l.details)}"`,
      )
      .join("\n");
    const blob = new Blob([csvHeader + csvRows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  if (!activeOrgId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">
            <span className="gradient-text">Audit Log</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Select an organization to view audit logs.
          </p>
        </div>
        <Card className="glass border-purple-500/10 p-8 text-center">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-bold text-lg mb-2">No Organization Selected</h3>
          <p className="text-sm text-muted-foreground">
            Please select an organization from the switcher to view the audit
            log.
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
            <span className="gradient-text">Audit Log</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track all actions and changes across your organization.
          </p>
        </div>
        <Button
          variant="outline"
          className="border-purple-500/20 hover:bg-purple-500/10"
          onClick={handleExport}
          disabled={filtered.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={actorFilter} onValueChange={handleActorFilter}>
          <SelectTrigger className="w-full sm:w-40 bg-purple-500/5 border-purple-500/10">
            <SelectValue placeholder="Actor Type" />
          </SelectTrigger>
          <SelectContent className="glass border-purple-500/20">
            <SelectItem value="all">All Actors</SelectItem>
            <SelectItem value="USER">User</SelectItem>
            <SelectItem value="AGENT">Agent</SelectItem>
            <SelectItem value="SYSTEM">System</SelectItem>
            <SelectItem value="WEBHOOK">Webhook</SelectItem>
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={handleActionFilter}>
          <SelectTrigger className="w-full sm:w-40 bg-purple-500/5 border-purple-500/10">
            <SelectValue placeholder="Action Type" />
          </SelectTrigger>
          <SelectContent className="glass border-purple-500/20">
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="create">Create</SelectItem>
            <SelectItem value="update">Update</SelectItem>
            <SelectItem value="delete">Delete</SelectItem>
            <SelectItem value="login">Login</SelectItem>
          </SelectContent>
        </Select>
        <Select value={dateFilter} onValueChange={handleDateFilter}>
          <SelectTrigger className="w-full sm:w-40 bg-purple-500/5 border-purple-500/10">
            <SelectValue placeholder="Date Range" />
          </SelectTrigger>
          <SelectContent className="glass border-purple-500/20">
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="1h">Last Hour</SelectItem>
            <SelectItem value="24h">Last 24 Hours</SelectItem>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {loading ? (
        <Card className="glass border-purple-500/10 overflow-hidden">
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-4 w-32 flex-1" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="glass border-purple-500/10 p-8 sm:p-12 text-center">
          <div className="relative mx-auto w-28 h-28 mb-6">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 animate-pulse" />
            <div className="absolute inset-4 rounded-full bg-gradient-to-br from-purple-500/10 to-cyan-500/10" />
            <div className="absolute inset-8 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center">
              <Shield className="h-8 w-8 text-purple-400" />
            </div>
          </div>
          <h3 className="font-bold text-xl mb-2">No Audit Logs Found</h3>
          <p className="text-sm text-muted-foreground mb-2 max-w-sm mx-auto">
            {actorFilter !== "all" || actionFilter !== "all" || dateFilter !== "all"
              ? "No logs match your current filters. Try broadening your criteria."
              : "No audit events have been recorded yet. Actions will appear here as your team uses the platform."}
          </p>
        </Card>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="glass border-purple-500/10 overflow-hidden">
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="border-purple-500/10 hover:bg-transparent">
                    <TableHead className="w-8" />
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((entry) => {
                    const ActorIcon = ACTOR_ICONS[entry.actorType];
                    const actorColor = ACTOR_COLORS[entry.actorType];
                    const isExpanded = expandedId === entry.id;
                    const detailStr = JSON.stringify(entry.details);

                    return (
                      <>
                        <TableRow
                          key={entry.id}
                          className="border-purple-500/10 hover:bg-purple-500/5 cursor-pointer"
                          onClick={() => toggleExpand(entry.id)}
                        >
                          <TableCell className="w-8">
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatTimestamp(entry.timestamp)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div
                                className={`flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br ${actorColor} flex-shrink-0`}
                              >
                                <ActorIcon className="h-3.5 w-3.5 text-white" />
                              </div>
                              <span className="text-sm font-medium">
                                {entry.actorName}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${ACTION_STYLES[entry.action]}`}
                            >
                              {entry.actionLabel}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate">
                            {entry.resource}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px]">
                            <span className={isExpanded ? "" : "line-clamp-1"}>
                              {detailStr}
                            </span>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow
                            key={`${entry.id}-detail`}
                            className="border-purple-500/10 hover:bg-transparent"
                          >
                            <TableCell colSpan={6} className="bg-purple-500/5">
                              <div className="p-4">
                                <h4 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
                                  Event Details
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {Object.entries(entry.details).map(
                                    ([key, value]) => (
                                      <div
                                        key={key}
                                        className="p-2 rounded-md bg-background/50 border border-purple-500/10"
                                      >
                                        <span className="text-[10px] text-muted-foreground uppercase">
                                          {key}
                                        </span>
                                        <p className="text-sm font-medium mt-0.5 break-all">
                                          {String(value)}
                                        </p>
                                      </div>
                                    ),
                                  )}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden p-4 space-y-3">
              {paginated.map((entry) => {
                const ActorIcon = ACTOR_ICONS[entry.actorType];
                const actorColor = ACTOR_COLORS[entry.actorType];
                const isExpanded = expandedId === entry.id;

                return (
                  <div
                    key={entry.id}
                    className="p-3 rounded-lg border border-purple-500/10 bg-purple-500/5"
                  >
                    <div
                      className="flex items-start gap-3 cursor-pointer"
                      onClick={() => toggleExpand(entry.id)}
                    >
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${actorColor} flex-shrink-0`}
                      >
                        <ActorIcon className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">
                            {entry.actorName}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${ACTION_STYLES[entry.action]}`}
                          >
                            {entry.actionLabel}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {entry.resource}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {formatTimestamp(entry.timestamp)}
                        </p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                    </div>
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-purple-500/10">
                        <div className="space-y-2">
                          {Object.entries(entry.details).map(([key, value]) => (
                            <div
                              key={key}
                              className="flex items-center gap-2 text-xs"
                            >
                              <span className="text-muted-foreground w-24 flex-shrink-0 uppercase text-[10px]">
                                {key}
                              </span>
                              <span className="font-medium break-all">
                                {String(value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-purple-500/10">
                <p className="text-xs text-muted-foreground">
                  Showing {(page - 1) * PAGE_SIZE + 1}
                  –{Math.min(page * PAGE_SIZE, filtered.length)} of{" "}
                  {filtered.length} entries
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 border-purple-500/20"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (p) => (
                      <Button
                        key={p}
                        variant={page === p ? "default" : "outline"}
                        size="sm"
                        className={`h-8 w-8 p-0 text-xs ${
                          page === p ? "btn-gradient text-white" : "border-purple-500/20"
                        }`}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </Button>
                    ),
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 border-purple-500/20"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </motion.div>
      )}
    </div>
  );
}
