"use client";

import { useEffect, useState, useMemo } from "react";
import { useApp } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Bot,
  PlusCircle,
  Search,
  Eye,
  Pencil,
  Play,
  Archive,
  Sparkles,
  Wrench,
  Globe,
} from "lucide-react";
import { motion } from "framer-motion";

type AgentStatus =
  | "DRAFT"
  | "CONFIGURED"
  | "TESTING"
  | "ACTIVE"
  | "PAUSED"
  | "DEPRECATED";

type AutonomyLevel = "L0" | "L1" | "L2" | "L3" | "L4" | "L5";

interface AiAgent {
  id: string;
  name: string;
  description: string;
  status: AgentStatus;
  autonomyLevel: AutonomyLevel;
  domain: string;
  toolsCount: number;
  createdAt: string;
}

const STATUS_STYLES: Record<AgentStatus, string> = {
  DRAFT: "bg-gray-500/20 text-gray-300 border-gray-500/30",
  CONFIGURED: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  TESTING: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  ACTIVE: "bg-green-500/20 text-green-300 border-green-500/30",
  PAUSED: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  DEPRECATED: "bg-red-500/20 text-red-300 border-red-500/30",
};

const AUTONOMY_STYLES: Record<AutonomyLevel, string> = {
  L0: "bg-gray-500/20 text-gray-300 border-gray-500/30",
  L1: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  L2: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  L3: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  L4: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  L5: "bg-red-500/20 text-red-300 border-red-500/30",
};

const AUTONOMY_LABELS: Record<AutonomyLevel, string> = {
  L0: "L0 · Manual",
  L1: "L1 · Assisted",
  L2: "L2 · Semi-Auto",
  L3: "L3 · Autonomous",
  L4: "L4 · Self-Directed",
  L5: "L5 · Fully Auto",
};

const DOMAIN_ICONS: Record<string, React.ElementType> = {
  "General": Sparkles,
  "Engineering": Wrench,
  "Marketing": Globe,
  "Support": Bot,
};

const PLACEHOLDER_AGENTS: AiAgent[] = [
  {
    id: "agent-001",
    name: "Code Reviewer",
    description:
      "Reviews pull requests, identifies bugs, suggests improvements, and enforces coding standards across the team's repositories.",
    status: "ACTIVE",
    autonomyLevel: "L3",
    domain: "Engineering",
    toolsCount: 5,
    createdAt: "2024-09-15T10:00:00Z",
  },
  {
    id: "agent-002",
    name: "Content Writer",
    description:
      "Generates blog posts, social media content, and marketing copy based on brand guidelines and SEO best practices.",
    status: "ACTIVE",
    autonomyLevel: "L4",
    domain: "Marketing",
    toolsCount: 3,
    createdAt: "2024-10-01T14:30:00Z",
  },
  {
    id: "agent-003",
    name: "Support Triage",
    description:
      "Automatically categorizes and prioritizes incoming support tickets, routes them to the right team, and suggests solutions.",
    status: "TESTING",
    autonomyLevel: "L2",
    domain: "Support",
    toolsCount: 4,
    createdAt: "2024-11-10T09:15:00Z",
  },
  {
    id: "agent-004",
    name: "Data Analyst",
    description:
      "Performs automated data analysis, generates reports, and surfaces insights from the organization's data pipelines.",
    status: "CONFIGURED",
    autonomyLevel: "L3",
    domain: "Engineering",
    toolsCount: 7,
    createdAt: "2024-12-01T11:00:00Z",
  },
  {
    id: "agent-005",
    name: "DevOps Assistant",
    description:
      "Manages infrastructure, monitors deployments, handles incidents, and performs routine maintenance tasks autonomously.",
    status: "ACTIVE",
    autonomyLevel: "L5",
    domain: "Engineering",
    toolsCount: 12,
    createdAt: "2024-08-20T08:00:00Z",
  },
  {
    id: "agent-006",
    name: "Onboarding Bot",
    description:
      "Guides new users through the product onboarding process with personalized tutorials and contextual help.",
    status: "DRAFT",
    autonomyLevel: "L1",
    domain: "Support",
    toolsCount: 2,
    createdAt: "2025-01-05T16:00:00Z",
  },
];

export function AiAgentsView() {
  const { activeOrgId } = useApp();
  const [agents, setAgents] = useState<AiAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [autonomyFilter, setAutonomyFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newInstructions, setNewInstructions] = useState("");

  useEffect(() => {
    if (!activeOrgId) return;
    fetch(`/api/organizations/${activeOrgId}/ai-agents`)
      .then((r) => r.json())
      .then((data) => {
        setAgents(data.agents?.length ? data.agents : PLACEHOLDER_AGENTS);
        setLoading(false);
      })
      .catch(() => {
        setAgents(PLACEHOLDER_AGENTS);
        setLoading(false);
      });
  }, [activeOrgId]);

  const filtered = useMemo(() => {
    let result = agents;
    if (statusFilter !== "all") {
      result = result.filter((a) => a.status === statusFilter);
    }
    if (autonomyFilter !== "all") {
      result = result.filter((a) => a.autonomyLevel === autonomyFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.domain.toLowerCase().includes(q),
      );
    }
    return result;
  }, [agents, statusFilter, autonomyFilter, searchQuery]);

  const handleCreate = () => {
    if (!newName.trim()) return;
    const newAgent: AiAgent = {
      id: `agent-${Date.now()}`,
      name: newName.trim(),
      description: newDesc.trim() || "New AI agent",
      status: "DRAFT",
      autonomyLevel: "L0",
      domain: "General",
      toolsCount: 0,
      createdAt: new Date().toISOString(),
    };
    setAgents((prev) => [newAgent, ...prev]);
    setCreateOpen(false);
    setNewName("");
    setNewDesc("");
    setNewInstructions("");
  };

  const handleArchive = (id: string) => {
    setAgents((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, status: "DEPRECATED" as AgentStatus } : a,
      ),
    );
  };

  if (!activeOrgId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">
            <span className="gradient-text">AI Agents</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Select an organization to manage AI agents.
          </p>
        </div>
        <Card className="glass border-purple-500/10 p-8 text-center">
          <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-bold text-lg mb-2">No Organization Selected</h3>
          <p className="text-sm text-muted-foreground">
            Please select an organization from the switcher to view and manage
            AI agents.
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
            <span className="gradient-text">AI Agents</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage autonomous AI agents for your organization.
          </p>
        </div>
        <Button
          className="btn-gradient text-white"
          onClick={() => setCreateOpen(true)}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Create Agent
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-purple-500/5 border-purple-500/10 focus:border-purple-500/30"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40 bg-purple-500/5 border-purple-500/10">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="glass border-purple-500/20">
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="CONFIGURED">Configured</SelectItem>
            <SelectItem value="TESTING">Testing</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="PAUSED">Paused</SelectItem>
            <SelectItem value="DEPRECATED">Deprecated</SelectItem>
          </SelectContent>
        </Select>
        <Select value={autonomyFilter} onValueChange={setAutonomyFilter}>
          <SelectTrigger className="w-full sm:w-40 bg-purple-500/5 border-purple-500/10">
            <SelectValue placeholder="Autonomy" />
          </SelectTrigger>
          <SelectContent className="glass border-purple-500/20">
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="L0">L0 · Manual</SelectItem>
            <SelectItem value="L1">L1 · Assisted</SelectItem>
            <SelectItem value="L2">L2 · Semi-Auto</SelectItem>
            <SelectItem value="L3">L3 · Autonomous</SelectItem>
            <SelectItem value="L4">L4 · Self-Directed</SelectItem>
            <SelectItem value="L5">L5 · Fully Auto</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="glass border-purple-500/10 p-5">
              <div className="flex items-start justify-between mb-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex gap-1">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              </div>
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-full mb-1" />
              <Skeleton className="h-3 w-3/4 mb-4" />
              <div className="flex justify-between">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-16" />
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
              <Bot className="h-8 w-8 text-purple-400" />
            </div>
          </div>
          <h3 className="font-bold text-xl mb-2">No AI Agents Found</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
            {searchQuery || statusFilter !== "all" || autonomyFilter !== "all"
              ? "No agents match your current filters. Try adjusting your search criteria."
              : "Create your first AI agent to automate tasks and boost your team's productivity."}
          </p>
          {!searchQuery && statusFilter === "all" && autonomyFilter === "all" && (
            <Button
              className="btn-gradient text-white"
              onClick={() => setCreateOpen(true)}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Agent
            </Button>
          )}
        </Card>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {filtered.map((agent, index) => {
            const DomainIcon =
              DOMAIN_ICONS[agent.domain] || Sparkles;

            return (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="glass border-purple-500/10 p-5 card-hover h-full flex flex-col">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-purple-500/10 flex-shrink-0">
                      <DomainIcon className="h-5 w-5 text-purple-400" />
                    </div>
                    <div className="flex gap-1.5 flex-wrap justify-end">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${STATUS_STYLES[agent.status]}`}
                      >
                        {agent.status.charAt(0) +
                          agent.status.slice(1).toLowerCase()}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${AUTONOMY_STYLES[agent.autonomyLevel]}`}
                      >
                        {AUTONOMY_LABELS[agent.autonomyLevel]}
                      </Badge>
                    </div>
                  </div>

                  {/* Name + Description */}
                  <h3 className="font-semibold mb-1.5">{agent.name}</h3>
                  <p className="text-xs text-muted-foreground mb-4 flex-1 line-clamp-3">
                    {agent.description}
                  </p>

                  {/* Meta */}
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-4">
                    <span className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      {agent.domain}
                    </span>
                    <span className="flex items-center gap-1">
                      <Wrench className="h-3 w-3" />
                      {agent.toolsCount} tools
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 text-xs border-purple-500/20 hover:bg-purple-500/10"
                    >
                      <Eye className="mr-1.5 h-3 w-3" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 text-xs border-purple-500/20 hover:bg-purple-500/10"
                    >
                      <Pencil className="mr-1.5 h-3 w-3" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 text-xs border-purple-500/20 hover:bg-green-500/10 hover:text-green-300 hover:border-green-500/20"
                    >
                      <Play className="mr-1.5 h-3 w-3" />
                      Run
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0 border-purple-500/20 hover:bg-orange-500/10 hover:text-orange-300 hover:border-orange-500/20"
                      onClick={() => handleArchive(agent.id)}
                    >
                      <Archive className="h-3 w-3" />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Create Agent Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="glass border-purple-500/20 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-purple-400" />
              Create AI Agent
            </DialogTitle>
            <DialogDescription>
              Define a new AI agent for your organization. You can configure tools
              and autonomy levels after creation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="agent-name">Name</Label>
              <Input
                id="agent-name"
                placeholder="e.g. Code Reviewer"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-purple-500/5 border-purple-500/10 focus:border-purple-500/30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-desc">Description</Label>
              <Textarea
                id="agent-desc"
                placeholder="Describe what this agent does..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                rows={3}
                className="bg-purple-500/5 border-purple-500/10 focus:border-purple-500/30 resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-instructions">Instructions</Label>
              <Textarea
                id="agent-instructions"
                placeholder="Define the agent's behavior, rules, and constraints..."
                value={newInstructions}
                onChange={(e) => setNewInstructions(e.target.value)}
                rows={4}
                className="bg-purple-500/5 border-purple-500/10 focus:border-purple-500/30 resize-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              className="border-purple-500/20"
            >
              Cancel
            </Button>
            <Button
              className="btn-gradient text-white"
              onClick={handleCreate}
              disabled={!newName.trim()}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Agent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
