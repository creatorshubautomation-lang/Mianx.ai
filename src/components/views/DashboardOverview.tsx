"use client";

import { useEffect, useState } from "react";
import { useApp, useT } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AgentAvatar } from "../mianx/AgentAvatar";
import { useSession } from "next-auth/react";
import {
  FolderKanban,
  CheckCircle2,
  FileBox,
  MessageSquare,
  PlusCircle,
  ArrowRight,
  Activity,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";

interface Project {
  id: string;
  title: string;
  status: string;
  progress: number;
  projectType: string;
  updatedAt: string;
  agents: { agent: { name: string; icon: string; color: string; role: string } }[];
  _count: { tasks: number; messages: number; deliverables: number };
}

export function DashboardOverview() {
  const t = useT();
  const { navigate, setSelectedProject } = useApp();
  const { data: session } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        setProjects(data.projects || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const active = projects.filter(
    (p) => !["COMPLETED", "CANCELLED"].includes(p.status),
  );
  const completed = projects.filter((p) => p.status === "COMPLETED");
  const totalDeliverables = projects.reduce(
    (sum, p) => sum + p._count.deliverables,
    0,
  );
  const totalMessages = projects.reduce(
    (sum, p) => sum + p._count.messages,
    0,
  );

  const stats = [
    {
      label: t("dash.activeProjects"),
      value: active.length,
      icon: FolderKanban,
      color: "from-purple-500 to-violet-500",
    },
    {
      label: t("dash.completedProjects"),
      value: completed.length,
      icon: CheckCircle2,
      color: "from-green-500 to-emerald-500",
    },
    {
      label: t("dash.totalDeliverables"),
      value: totalDeliverables,
      icon: FileBox,
      color: "from-cyan-500 to-blue-500",
    },
    {
      label: t("dash.agentMessages"),
      value: totalMessages,
      icon: MessageSquare,
      color: "from-pink-500 to-rose-500",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">
            {t("dash.welcome")},{" "}
            <span className="gradient-text">
              {session?.user?.name?.split(" ")[0] || "there"}
            </span>{" "}
            👋
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Here&apos;s what your AI agents have been up to.
          </p>
        </div>
        <Button
          onClick={() => navigate("newProject")}
          className="btn-gradient text-white"
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          {t("dash.newProject")}
        </Button>
      </div>

      {/* Stats */}
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

      {/* Projects */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{t("dash.projects")}</h2>
          {projects.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("projects")}
              className="text-xs"
            >
              {t("common.viewAll")}
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 glass rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <Card className="glass border-purple-500/10 p-12 text-center">
            <div className="mx-auto h-14 w-14 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center mb-4">
              <Sparkles className="h-7 w-7 text-purple-400" />
            </div>
            <h3 className="font-semibold text-lg mb-2">
              {t("dash.noProjects")}
            </h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Create your first project and watch AI agents design, build, and deliver it in record time.
            </p>
            <Button
              onClick={() => navigate("newProject")}
              className="btn-gradient text-white"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              {t("dash.createProject")}
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {projects.slice(0, 5).map((p) => (
              <Card
                key={p.id}
                className="glass border-purple-500/10 p-5 card-hover cursor-pointer"
                onClick={() => {
                  setSelectedProject(p.id);
                  navigate("projectDetail", { id: p.id });
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold truncate">{p.title}</h3>
                      <Badge
                        variant="outline"
                        className="text-xs glass flex-shrink-0"
                      >
                        {p.projectType}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      Last updated{" "}
                      {new Date(p.updatedAt).toLocaleDateString()}
                    </p>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex -space-x-2">
                        {p.agents.slice(0, 5).map((a, i) => (
                          <div
                            key={i}
                            className="ring-2 ring-background rounded-full"
                          >
                            <AgentAvatar
                              name={a.agent.name}
                              icon={a.agent.icon}
                              color={a.agent.color}
                              size="sm"
                            />
                          </div>
                        ))}
                        {p.agents.length > 5 && (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium ring-2 ring-background">
                            +{p.agents.length - 5}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {p.agents.length} agents ·{" "}
                        {p._count.tasks} tasks ·{" "}
                        {p._count.deliverables} deliverables
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={p.progress} className="h-1.5 flex-1" />
                      <span className="text-xs text-muted-foreground w-10 text-right">
                        {p.progress}%
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
