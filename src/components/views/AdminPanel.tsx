"use client";

import { useEffect, useState, useMemo } from "react";
import { useApp } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { AgentAvatar } from "../mianx/AgentAvatar";
import { AiProviderDashboard } from "../mianx/AiProviderDashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  FolderKanban,
  Bot,
  DollarSign,
  Loader2,
  TrendingUp,
  Activity,
  Shield,
  Cpu,
  Search,
  Download,
  UserCog,
  ChevronUp,
  ChevronDown,
  Calendar,
  TicketCheck,
  Filter,
  Eye,
  Ban,
  ToggleLeft,
  MessageSquare,
  Clock,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

interface AdminData {
  stats: {
    totalClients: number;
    totalProjects: number;
    activeProjects: number;
    completedProjects: number;
    totalAgents: number;
    totalDeliverables: number;
    totalMessages: number;
    monthlyRevenue: number;
  };
  recentClients: {
    id: string;
    name: string;
    email: string;
    company: string | null;
    createdAt: string;
    _count: { projects: number };
  }[];
  recentProjects: {
    id: string;
    title: string;
    status: string;
    progress: number;
    createdAt: string;
    client: { name: string; email: string };
    _count: { tasks: number; messages: number; deliverables: number };
  }[];
  projectsByStatus: { status: string; _count: number }[];
  agentActivity: {
    id: string;
    name: string;
    role: string;
    team: string;
    icon: string;
    color: string;
    _count: { assignments: number; messages: number };
  }[];
}

// Placeholder support tickets data
const PLACEHOLDER_TICKETS = [
  {
    id: "tkt-001",
    subject: "Cannot connect AI provider",
    user: "Alice Johnson",
    email: "alice@example.com",
    status: "open" as const,
    priority: "high" as const,
    createdAt: "2025-01-12T09:30:00Z",
    lastMessage: "I keep getting a timeout error when trying to use the OpenAI provider...",
  },
  {
    id: "tkt-002",
    subject: "Agent not responding in project",
    user: "Bob Smith",
    email: "bob@company.com",
    status: "in_progress" as const,
    priority: "medium" as const,
    createdAt: "2025-01-11T14:15:00Z",
    lastMessage: "The design agent stopped replying after the third task was assigned.",
  },
  {
    id: "tkt-003",
    subject: "Billing question about monthly invoice",
    user: "Carol White",
    email: "carol@startup.io",
    status: "resolved" as const,
    priority: "low" as const,
    createdAt: "2025-01-10T11:00:00Z",
    lastMessage: "Thanks for clarifying the prorated charge, that makes sense now.",
  },
  {
    id: "tkt-004",
    subject: "Feature request: dark mode for reports",
    user: "Dave Brown",
    email: "dave@agency.co",
    status: "open" as const,
    priority: "low" as const,
    createdAt: "2025-01-09T16:45:00Z",
    lastMessage: "It would be great if the exported PDF reports supported dark theme.",
  },
  {
    id: "tkt-005",
    subject: "Error when uploading deliverable",
    user: "Eve Davis",
    email: "eve@freelance.dev",
    status: "in_progress" as const,
    priority: "high" as const,
    createdAt: "2025-01-08T08:20:00Z",
    lastMessage: "Getting a 413 error when trying to upload a 25MB design file.",
  },
];

// Hardcoded trend data for stats cards
const STATS_TRENDS = {
  totalClients: { change: 12.5, direction: "up" as const },
  totalProjects: { change: 8.3, direction: "up" as const },
  totalAgents: { change: 4.2, direction: "up" as const },
  monthlyRevenue: { change: 18.7, direction: "up" as const },
};

const DATE_RANGES = ["7d", "30d", "all"] as const;
type DateRange = (typeof DATE_RANGES)[number];

export function AdminPanel() {
  const { navigate, setSelectedProject } = useApp();
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search states
  const [userSearch, setUserSearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [projectStatusFilter, setProjectStatusFilter] = useState<string>("all");

  // Date range filter
  const [dateRange, setDateRange] = useState<DateRange>("all");

  useEffect(() => {
    fetch("/api/admin")
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) {
          setError(
            json.error ||
              json.details ||
              `Failed to load admin data (status ${r.status})`,
          );
          console.error("[admin] API error:", r.status, json);
          setLoading(false);
          return;
        }
        if (json.stats) setData(json);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message || "Network error");
        setLoading(false);
      });
  }, []);

  // Filtered data with search
  const filteredClients = useMemo(() => {
    if (!data) return [];
    const q = userSearch.toLowerCase();
    if (!q) return data.recentClients;
    return data.recentClients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.company && c.company.toLowerCase().includes(q)),
    );
  }, [data, userSearch]);

  const filteredProjects = useMemo(() => {
    if (!data) return [];
    const q = projectSearch.toLowerCase();
    let result = data.recentProjects;
    if (q) {
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.client.name.toLowerCase().includes(q),
      );
    }
    if (projectStatusFilter !== "all") {
      result = result.filter(
        (p) => p.status.toLowerCase() === projectStatusFilter.toLowerCase(),
      );
    }
    return result;
  }, [data, projectSearch, projectStatusFilter]);

  // Get unique project statuses from data
  const projectStatuses = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.recentProjects.map((p) => p.status))];
  }, [data]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-20 max-w-md mx-auto">
        <Shield className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-muted-foreground mb-2">Admin access required.</p>
        {error && (
          <div className="mt-3 p-3 rounded-md glass text-xs text-left">
            <p className="font-semibold text-red-400 mb-1">Error details:</p>
            <p className="text-muted-foreground break-words">{error}</p>
            <p className="mt-3 text-muted-foreground">
              Try: Logout → clear cookies → login again. If still failing,
              visit <code className="text-purple-300">/api/session</code> to
              see your current role.
            </p>
          </div>
        )}
      </div>
    );
  }

  const stats = [
    {
      label: "Total Clients",
      value: data.stats.totalClients,
      icon: Users,
      color: "from-purple-500 to-violet-500",
      trend: STATS_TRENDS.totalClients,
    },
    {
      label: "Total Projects",
      value: data.stats.totalProjects,
      icon: FolderKanban,
      color: "from-cyan-500 to-blue-500",
      trend: STATS_TRENDS.totalProjects,
    },
    {
      label: "Active Agents",
      value: data.stats.totalAgents,
      icon: Bot,
      color: "from-pink-500 to-rose-500",
      trend: STATS_TRENDS.totalAgents,
    },
    {
      label: "Monthly Revenue",
      value: `$${data.stats.monthlyRevenue.toLocaleString()}`,
      icon: DollarSign,
      color: "from-green-500 to-emerald-500",
      trend: STATS_TRENDS.monthlyRevenue,
    },
  ];

  const secondaryStats = [
    { label: "Active Projects", value: data.stats.activeProjects },
    { label: "Completed", value: data.stats.completedProjects },
    { label: "Deliverables", value: data.stats.totalDeliverables },
    { label: "Agent Messages", value: data.stats.totalMessages },
  ];

  const handleExportCSV = () => {
    toast.info("Export CSV", { description: "CSV export will be available soon." });
  };

  const handleUserAction = (action: string, userName: string) => {
    toast.info(`${action} — ${userName}`, {
      description: "This feature is coming soon.",
    });
  };

  const statusColorMap: Record<string, string> = {
    open: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    in_progress: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    resolved: "bg-green-500/15 text-green-400 border-green-500/30",
    closed: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  };

  const priorityColorMap: Record<string, string> = {
    high: "bg-red-500/15 text-red-400 border-red-500/30",
    medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    low: "bg-green-500/15 text-green-400 border-green-500/30",
  };

  const statusIconMap: Record<string, React.ReactNode> = {
    open: <AlertCircle className="h-3 w-3" />,
    in_progress: <Clock className="h-3 w-3" />,
    resolved: <CheckCircle2 className="h-3 w-3" />,
    closed: <CheckCircle2 className="h-3 w-3" />,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">
              Admin Control Panel
            </h1>
            <p className="text-sm text-muted-foreground">
              Overview of Mianx.ai platform activity
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats Summary Bar */}
      <Card className="glass border-purple-500/10 p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            { label: "Clients", value: data.stats.totalClients, icon: Users },
            { label: "Projects", value: data.stats.totalProjects, icon: FolderKanban },
            { label: "Active", value: data.stats.activeProjects, icon: Activity },
            { label: "Completed", value: data.stats.completedProjects, icon: CheckCircle2 },
            { label: "Agents", value: data.stats.totalAgents, icon: Bot },
            { label: "Deliverables", value: data.stats.totalDeliverables, icon: TrendingUp },
            { label: "Messages", value: data.stats.totalMessages, icon: MessageSquare },
            {
              label: "Revenue",
              value: `$${data.stats.monthlyRevenue.toLocaleString()}`,
              icon: DollarSign,
            },
          ].map((kpi) => (
            <div key={kpi.label} className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <kpi.icon className="h-3.5 w-3.5 text-purple-400" />
                <span className="text-xs text-muted-foreground">{kpi.label}</span>
              </div>
              <div className="text-lg sm:text-xl font-bold gradient-text">
                {kpi.value}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Primary stats with trend indicators */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="glass border-purple-500/10 p-5 card-hover">
              <div className="flex items-start justify-between mb-3">
                <div
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${s.color}`}
                >
                  <s.icon className="h-4 w-4 text-white" />
                </div>
                <div
                  className={`flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full ${
                    s.trend.direction === "up"
                      ? "text-green-400 bg-green-500/10"
                      : "text-red-400 bg-red-500/10"
                  }`}
                >
                  {s.trend.direction === "up" ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                  {s.trend.change}%
                </div>
              </div>
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* 4 Tabs: Overview | Users | Projects | AI Providers */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4 glass">
          <TabsTrigger value="overview" className="text-sm">
            <Activity className="h-4 w-4 mr-1.5 hidden sm:inline" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="users" className="text-sm">
            <Users className="h-4 w-4 mr-1.5 hidden sm:inline" />
            Users
          </TabsTrigger>
          <TabsTrigger value="projects" className="text-sm">
            <FolderKanban className="h-4 w-4 mr-1.5 hidden sm:inline" />
            Projects
          </TabsTrigger>
          <TabsTrigger value="ai" className="text-sm">
            <Cpu className="h-4 w-4 mr-1.5 hidden sm:inline" />
            AI Providers
          </TabsTrigger>
        </TabsList>

        {/* ==================== OVERVIEW TAB ==================== */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          {/* Date range filter + Export CSV */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Period:</span>
              <div className="flex gap-1">
                {DATE_RANGES.map((range) => (
                  <Button
                    key={range}
                    variant={dateRange === range ? "default" : "outline"}
                    size="sm"
                    className={`text-xs h-8 ${
                      dateRange === range
                        ? "bg-gradient-to-r from-purple-500 to-cyan-500 text-white border-0"
                        : "glass"
                    }`}
                    onClick={() => {
                      if (range === "7d" || range === "30d") {
                        toast.info("Coming soon", {
                          description: `Date filtering for "${range === "7d" ? "7 Days" : "30 Days"}" will be available soon.`,
                        });
                      }
                      setDateRange(range);
                    }}
                  >
                    {range === "7d"
                      ? "7 Days"
                      : range === "30d"
                        ? "30 Days"
                        : "All Time"}
                  </Button>
                ))}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="glass text-xs h-8"
              onClick={handleExportCSV}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export CSV
            </Button>
          </div>

          {/* Secondary stats */}
          <Card className="glass border-purple-500/10 p-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {secondaryStats.map((s) => (
                <div key={s.label} className="text-center">
                  <div className="text-xl font-bold gradient-text">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Agent performance */}
          <Card className="glass border-purple-500/10 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-purple-400" />
              <h3 className="font-semibold">Agent Performance</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.agentActivity.map((a) => (
                <div key={a.id} className="glass rounded-lg p-3">
                  <div className="flex items-center gap-3 mb-3">
                    <AgentAvatar
                      name={a.name}
                      icon={a.icon}
                      color={a.color}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{a.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {a.role}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-center glass rounded p-2">
                      <div className="text-sm font-bold">
                        {a._count.assignments}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        projects
                      </div>
                    </div>
                    <div className="text-center glass rounded p-2">
                      <div className="text-sm font-bold">
                        {a._count.messages}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        messages
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Recent Support Tickets - Quick View */}
          <Card className="glass border-purple-500/10 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TicketCheck className="h-4 w-4 text-purple-400" />
                <h3 className="font-semibold">Recent Support Tickets</h3>
              </div>
              <Badge variant="outline" className="glass text-xs">
                {PLACEHOLDER_TICKETS.length} total
              </Badge>
            </div>
            <div className="space-y-3">
              {PLACEHOLDER_TICKETS.slice(0, 3).map((ticket) => (
                <div
                  key={ticket.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 glass rounded-lg p-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs text-muted-foreground font-mono">
                        {ticket.id}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${statusColorMap[ticket.status] || "glass"}`}
                      >
                        {statusIconMap[ticket.status]}
                        <span className="ml-1">
                          {ticket.status === "in_progress"
                            ? "In Progress"
                            : ticket.status.charAt(0).toUpperCase() +
                              ticket.status.slice(1)}
                        </span>
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs ${priorityColorMap[ticket.priority] || "glass"}`}
                      >
                        {ticket.priority.charAt(0).toUpperCase() +
                          ticket.priority.slice(1)}
                      </Badge>
                    </div>
                    <div className="text-sm font-medium truncate">
                      {ticket.subject}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      from {ticket.user} · {new Date(ticket.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Projects by status */}
          <Card className="glass border-purple-500/10 p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-4 w-4 text-purple-400" />
              <h3 className="font-semibold">Projects by Status</h3>
            </div>
            <div className="space-y-2">
              {data.projectsByStatus.map((p) => {
                const total = data.stats.totalProjects || 1;
                const pct = (p._count / total) * 100;
                return (
                  <div key={p.status} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-28 capitalize">
                      {p.status.replace("_", " ").toLowerCase()}
                    </span>
                    <Progress value={pct} className="h-2 flex-1" />
                    <span className="text-xs font-medium w-8 text-right">
                      {p._count}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        {/* ==================== USERS TAB ==================== */}
        <TabsContent value="users" className="mt-6 space-y-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users by name, email, or company..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="pl-9 glass"
            />
          </div>

          {/* Results count */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {filteredClients.length} of {data.recentClients.length}{" "}
              users
            </p>
            <Badge variant="outline" className="glass text-xs">
              <UserCog className="h-3 w-3 mr-1" />
              User Management
            </Badge>
          </div>

          {/* Users list */}
          {filteredClients.length === 0 ? (
            <Card className="glass border-purple-500/10 p-10 text-center">
              <Search className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {userSearch
                  ? "No users match your search."
                  : "No clients yet."}
              </p>
            </Card>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {filteredClients.map((c) => (
                <Card
                  key={c.id}
                  className="glass border-purple-500/10 p-4 card-hover"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    {/* User info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 text-sm font-semibold text-white flex-shrink-0">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {c.name}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {c.email}
                        </div>
                        {c.company && (
                          <div className="text-xs text-purple-400/80 truncate mt-0.5">
                            {c.company}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Meta info */}
                    <div className="flex items-center gap-3">
                      <div className="text-center px-3">
                        <div className="text-sm font-bold">{c._count.projects}</div>
                        <div className="text-xs text-muted-foreground">
                          projects
                        </div>
                      </div>
                      <div className="text-center px-3 border-l border-purple-500/10">
                        <div className="text-xs text-muted-foreground">
                          Joined
                        </div>
                        <div className="text-xs font-medium">
                          {new Date(c.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 sm:ml-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="glass text-xs h-8"
                        onClick={() => handleUserAction("View details", c.name)}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="glass text-xs h-8"
                        onClick={() =>
                          handleUserAction("Toggle role", c.name)
                        }
                      >
                        <ToggleLeft className="h-3.5 w-3.5 mr-1" />
                        Role
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="glass text-xs h-8 text-red-400 hover:text-red-300 hover:border-red-500/30"
                        onClick={() =>
                          handleUserAction("Disable account", c.name)
                        }
                      >
                        <Ban className="h-3.5 w-3.5 mr-1" />
                        Disable
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ==================== PROJECTS TAB ==================== */}
        <TabsContent value="projects" className="mt-6 space-y-4">
          {/* Search + Status filter row */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search projects by title or client..."
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                className="pl-9 glass"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="flex gap-1 flex-wrap">
                <Button
                  variant={
                    projectStatusFilter === "all" ? "default" : "outline"
                  }
                  size="sm"
                  className={`text-xs h-8 ${
                    projectStatusFilter === "all"
                      ? "bg-gradient-to-r from-purple-500 to-cyan-500 text-white border-0"
                      : "glass"
                  }`}
                  onClick={() => setProjectStatusFilter("all")}
                >
                  All
                </Button>
                {projectStatuses.map((status) => (
                  <Button
                    key={status}
                    variant={
                      projectStatusFilter === status ? "default" : "outline"
                    }
                    size="sm"
                    className={`text-xs h-8 capitalize ${
                      projectStatusFilter === status
                        ? "bg-gradient-to-r from-purple-500 to-cyan-500 text-white border-0"
                        : "glass"
                    }`}
                    onClick={() => setProjectStatusFilter(status)}
                  >
                    {status.replace("_", " ")}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Results count */}
          <p className="text-sm text-muted-foreground">
            Showing {filteredProjects.length} of {data.recentProjects.length}{" "}
            projects
          </p>

          {/* Projects list */}
          {filteredProjects.length === 0 ? (
            <Card className="glass border-purple-500/10 p-10 text-center">
              <Search className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {projectSearch || projectStatusFilter !== "all"
                  ? "No projects match your filters."
                  : "No projects yet."}
              </p>
            </Card>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {filteredProjects.map((p) => (
                <Card
                  key={p.id}
                  className="glass border-purple-500/10 p-4 card-hover cursor-pointer"
                  onClick={() => {
                    setSelectedProject(p.id);
                    navigate("projectDetail", { id: p.id });
                  }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    {/* Project info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium truncate">
                          {p.title}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-xs glass flex-shrink-0 capitalize"
                        >
                          {p.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mb-2">
                        by {p.client.name} ({p.client.email})
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={p.progress} className="h-1.5 flex-1" />
                        <span className="text-xs text-muted-foreground font-medium">
                          {p.progress}%
                        </span>
                      </div>
                    </div>

                    {/* Project meta */}
                    <div className="flex items-center gap-4 sm:gap-6 sm:ml-4">
                      <div className="text-center">
                        <div className="text-sm font-bold">
                          {p._count.tasks}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          tasks
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-bold">
                          {p._count.messages}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          messages
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-bold">
                          {p._count.deliverables}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          files
                        </div>
                      </div>
                      <div className="text-center border-l border-purple-500/10 pl-4">
                        <div className="text-xs text-muted-foreground">
                          Created
                        </div>
                        <div className="text-xs font-medium">
                          {new Date(p.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ==================== AI PROVIDERS TAB ==================== */}
        <TabsContent value="ai" className="mt-6">
          <AiProviderDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
