"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AgentAvatar } from "../mianx/AgentAvatar";
import {
  Users,
  FolderKanban,
  Bot,
  DollarSign,
  Loader2,
  TrendingUp,
  Activity,
  Shield,
} from "lucide-react";
import { motion } from "framer-motion";

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

export function AdminPanel() {
  const { setView, setSelectedProject } = useApp();
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    },
    {
      label: "Total Projects",
      value: data.stats.totalProjects,
      icon: FolderKanban,
      color: "from-cyan-500 to-blue-500",
    },
    {
      label: "Active Agents",
      value: data.stats.totalAgents,
      icon: Bot,
      color: "from-pink-500 to-rose-500",
    },
    {
      label: "Monthly Revenue",
      value: `$${data.stats.monthlyRevenue.toLocaleString()}`,
      icon: DollarSign,
      color: "from-green-500 to-emerald-500",
    },
  ];

  const secondaryStats = [
    { label: "Active Projects", value: data.stats.activeProjects },
    { label: "Completed", value: data.stats.completedProjects },
    { label: "Deliverables", value: data.stats.totalDeliverables },
    { label: "Agent Messages", value: data.stats.totalMessages },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500">
          <Shield className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Admin Control Panel</h1>
          <p className="text-sm text-muted-foreground">
            Overview of Mianx.ai platform activity
          </p>
        </div>
      </div>

      {/* Primary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="glass border-purple-500/10 p-5 card-hover">
              <div
                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${s.color} mb-3`}
              >
                <s.icon className="h-4 w-4 text-white" />
              </div>
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </Card>
          </motion.div>
        ))}
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

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent clients */}
        <Card className="glass border-purple-500/10 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-purple-400" />
            <h3 className="font-semibold">Recent Clients</h3>
          </div>
          {data.recentClients.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No clients yet.
            </p>
          ) : (
            <div className="space-y-3">
              {data.recentClients.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 glass rounded-lg p-3"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 text-sm font-medium text-white">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {c.name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {c.email}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="text-xs glass">
                      {c._count.projects} projects
                    </Badge>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent projects */}
        <Card className="glass border-purple-500/10 p-5">
          <div className="flex items-center gap-2 mb-4">
            <FolderKanban className="h-4 w-4 text-purple-400" />
            <h3 className="font-semibold">Recent Projects</h3>
          </div>
          {data.recentProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No projects yet.
            </p>
          ) : (
            <div className="space-y-3">
              {data.recentProjects.map((p) => (
                <div
                  key={p.id}
                  className="glass rounded-lg p-3 cursor-pointer hover:border-purple-500/30 transition-colors"
                  onClick={() => {
                    setSelectedProject(p.id);
                    setView("projectDetail");
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium truncate">
                      {p.title}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-xs glass flex-shrink-0"
                    >
                      {p.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">
                    {p.client.name}
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={p.progress} className="h-1 flex-1" />
                    <span className="text-xs text-muted-foreground">
                      {p.progress}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

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
                  <div className="text-sm font-bold">{a._count.assignments}</div>
                  <div className="text-xs text-muted-foreground">projects</div>
                </div>
                <div className="text-center glass rounded p-2">
                  <div className="text-sm font-bold">{a._count.messages}</div>
                  <div className="text-xs text-muted-foreground">messages</div>
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
    </div>
  );
}
