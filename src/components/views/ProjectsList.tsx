"use client";

import { useEffect, useState } from "react";
import { useApp, useT } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AgentAvatar } from "../mianx/AgentAvatar";
import {
  PlusCircle,
  Loader2,
  Sparkles,
  Search,
  Filter,
} from "lucide-react";
import { Input } from "@/components/ui/input";

interface Project {
  id: string;
  title: string;
  status: string;
  progress: number;
  projectType: string;
  updatedAt: string;
  agents: { agent: { name: string; icon: string; color: string } }[];
  _count: { tasks: number; messages: number; deliverables: number };
}

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  BRIEFING: { label: "Briefing", color: "bg-gray-500/20 text-gray-300" },
  PLANNING: { label: "Planning", color: "bg-blue-500/20 text-blue-300" },
  IN_PROGRESS: { label: "In Progress", color: "bg-purple-500/20 text-purple-300" },
  REVIEW: { label: "In Review", color: "bg-amber-500/20 text-amber-300" },
  DELIVERED: { label: "Delivered", color: "bg-cyan-500/20 text-cyan-300" },
  COMPLETED: { label: "Completed", color: "bg-green-500/20 text-green-300" },
  ON_HOLD: { label: "On Hold", color: "bg-orange-500/20 text-orange-300" },
  CANCELLED: { label: "Cancelled", color: "bg-red-500/20 text-red-300" },
};

export function ProjectsList() {
  const t = useT();
  const { setView, setSelectedProject } = useApp();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        setProjects(data.projects || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = projects.filter((p) => {
    const matchesSearch = p.title
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesFilter = filter === "all" || p.status === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">
            {t("dash.projects")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {projects.length} projects · {projects.filter((p) => p.status === "IN_PROGRESS").length} active
          </p>
        </div>
        <Button
          onClick={() => setView("newProject")}
          className="btn-gradient text-white"
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          {t("dash.newProject")}
        </Button>
      </div>

      {/* Search + filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 glass"
          />
        </div>
        <div className="flex gap-1">
          {["all", "IN_PROGRESS", "COMPLETED"].map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
              className={`text-xs ${filter === f ? "btn-gradient text-white" : "glass"}`}
            >
              <Filter className="h-3 w-3 mr-1" />
              {f === "all" ? "All" : f === "IN_PROGRESS" ? "Active" : "Done"}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="glass border-purple-500/10 p-12 text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center mb-4">
            <Sparkles className="h-7 w-7 text-purple-400" />
          </div>
          <h3 className="font-semibold text-lg mb-2">
            {search ? "No projects match your search" : t("dash.noProjects")}
          </h3>
          <Button
            onClick={() => setView("newProject")}
            className="btn-gradient text-white mt-4"
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            {t("dash.createProject")}
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((p) => {
            const statusInfo = STATUS_BADGES[p.status] || STATUS_BADGES.IN_PROGRESS;
            return (
              <Card
                key={p.id}
                className="glass border-purple-500/10 p-5 card-hover cursor-pointer"
                onClick={() => {
                  setSelectedProject(p.id);
                  setView("projectDetail");
                }}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold truncate">{p.title}</h3>
                  <Badge className={statusInfo.color}>
                    {statusInfo.label}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="outline" className="text-xs glass">
                    {p.projectType}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Updated {new Date(p.updatedAt).toLocaleDateString()}
                  </span>
                </div>
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
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {p._count.tasks} tasks · {p._count.deliverables} files
                  </span>
                </div>
                <Progress value={p.progress} className="h-1.5" />
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
