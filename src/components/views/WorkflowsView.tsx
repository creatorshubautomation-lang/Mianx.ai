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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Workflow,
  PlusCircle,
  Search,
  Play,
  Pause,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  Zap,
  RefreshCw,
} from "lucide-react";
import { motion } from "framer-motion";

type WorkflowStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";

interface WorkflowItem {
  id: string;
  name: string;
  status: WorkflowStatus;
  domain: string;
  runsCount: number;
  successRate: number;
  createdAt: string;
  description?: string;
  lastRunAt?: string;
  steps?: number;
}

const STATUS_STYLES: Record<WorkflowStatus, string> = {
  DRAFT: "bg-gray-500/20 text-gray-300 border-gray-500/30",
  ACTIVE: "bg-green-500/20 text-green-300 border-green-500/30",
  PAUSED: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  ARCHIVED: "bg-red-500/20 text-red-300 border-red-500/30",
};

const PLACEHOLDER_WORKFLOWS: WorkflowItem[] = [
  {
    id: "wf-001",
    name: "Customer Onboarding Pipeline",
    status: "ACTIVE",
    domain: "CRM",
    runsCount: 1243,
    successRate: 98.5,
    createdAt: "2024-11-15T10:30:00Z",
    description: "Automates the full customer onboarding flow including email verification, account setup, and welcome sequence.",
    lastRunAt: "2025-01-10T14:22:00Z",
    steps: 8,
  },
  {
    id: "wf-002",
    name: "Invoice Processing",
    status: "ACTIVE",
    domain: "Finance",
    runsCount: 856,
    successRate: 95.2,
    createdAt: "2024-10-20T08:15:00Z",
    description: "Processes incoming invoices, extracts data using OCR, validates amounts, and routes for approval.",
    lastRunAt: "2025-01-10T12:00:00Z",
    steps: 12,
  },
  {
    id: "wf-003",
    name: "Content Publishing Workflow",
    status: "PAUSED",
    domain: "Marketing",
    runsCount: 432,
    successRate: 91.7,
    createdAt: "2024-09-05T16:45:00Z",
    description: "Manages the content publishing pipeline from draft creation through review, approval, and multi-channel publishing.",
    lastRunAt: "2024-12-28T09:30:00Z",
    steps: 6,
  },
  {
    id: "wf-004",
    name: "DevOps Deployment Pipeline",
    status: "ACTIVE",
    domain: "Engineering",
    runsCount: 2104,
    successRate: 99.1,
    createdAt: "2024-08-10T11:00:00Z",
    description: "Full CI/CD pipeline with automated testing, staging deployment, and production rollout with rollback capability.",
    lastRunAt: "2025-01-10T15:45:00Z",
    steps: 15,
  },
  {
    id: "wf-005",
    name: "Lead Scoring Automation",
    status: "DRAFT",
    domain: "Sales",
    runsCount: 0,
    successRate: 0,
    createdAt: "2025-01-08T14:20:00Z",
    description: "AI-powered lead scoring system that evaluates and ranks leads based on engagement, demographics, and behavior.",
    steps: 5,
  },
  {
    id: "wf-006",
    name: "Security Compliance Scan",
    status: "ARCHIVED",
    domain: "Security",
    runsCount: 678,
    successRate: 87.3,
    createdAt: "2024-06-01T09:00:00Z",
    description: "Scheduled security scanning workflow that checks for vulnerabilities, misconfigurations, and compliance violations.",
    lastRunAt: "2024-11-30T02:00:00Z",
    steps: 10,
  },
];

export function WorkflowsView() {
  const { activeOrgId } = useApp();
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeOrgId) return;
    fetch(`/api/organizations/${activeOrgId}/workflows`)
      .then((r) => r.json())
      .then((data) => {
        setWorkflows(data.workflows?.length ? data.workflows : PLACEHOLDER_WORKFLOWS);
        setLoading(false);
      })
      .catch(() => {
        setWorkflows(PLACEHOLDER_WORKFLOWS);
        setLoading(false);
      });
  }, [activeOrgId]);

  const filtered = useMemo(() => {
    let result = workflows;
    if (statusFilter !== "all") {
      result = result.filter((w) => w.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (w) =>
          w.name.toLowerCase().includes(q) ||
          w.domain.toLowerCase().includes(q),
      );
    }
    return result;
  }, [workflows, statusFilter, searchQuery]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleAction = (action: string, id: string) => {
    if (action === "delete") {
      setWorkflows((prev) => prev.filter((w) => w.id !== id));
      return;
    }
    if (action === "toggle") {
      setWorkflows((prev) =>
        prev.map((w) =>
          w.id === id
            ? { ...w, status: w.status === "ACTIVE" ? "PAUSED" : "ACTIVE" }
            : w,
        ),
      );
    }
  };

  if (!activeOrgId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">
            <span className="gradient-text">Automations</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Select an organization to manage workflows.
          </p>
        </div>
        <Card className="glass border-purple-500/10 p-8 text-center">
          <Workflow className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-bold text-lg mb-2">No Organization Selected</h3>
          <p className="text-sm text-muted-foreground">
            Please select an organization from the switcher to view and manage workflows.
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
            <span className="gradient-text">Automations</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage and monitor your organization&apos;s automated workflows.
          </p>
        </div>
        <Button className="btn-gradient text-white">
          <PlusCircle className="mr-2 h-4 w-4" />
          Create Workflow
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search workflows..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 bg-purple-500/5 border-purple-500/10 focus:border-purple-500/30"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44 bg-purple-500/5 border-purple-500/10">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent className="glass border-purple-500/20">
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="PAUSED">Paused</SelectItem>
            <SelectItem value="ARCHIVED">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="glass border-purple-500/10 p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-24" />
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
              <Workflow className="h-8 w-8 text-purple-400" />
            </div>
          </div>
          <h3 className="font-bold text-xl mb-2">No Workflows Found</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
            {searchQuery || statusFilter !== "all"
              ? "No workflows match your current filters. Try adjusting your search criteria."
              : "Create your first workflow to automate repetitive tasks and boost productivity."}
          </p>
          {!searchQuery && statusFilter === "all" && (
            <Button className="btn-gradient text-white">
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Workflow
            </Button>
          )}
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
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead className="text-right">Runs</TableHead>
                    <TableHead className="text-right">Success Rate</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((wf) => (
                    <>
                      <TableRow
                        key={wf.id}
                        className="border-purple-500/10 hover:bg-purple-500/5 cursor-pointer"
                        onClick={() => toggleExpand(wf.id)}
                      >
                        <TableCell className="w-8">
                          {expandedId === wf.id ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-purple-500/20 to-violet-500/20 border border-purple-500/10">
                              <Zap className="h-4 w-4 text-purple-400" />
                            </div>
                            <span className="font-medium">{wf.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${STATUS_STYLES[wf.status]}`}
                          >
                            {wf.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {wf.domain}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {wf.runsCount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={
                              wf.successRate >= 95
                                ? "text-green-400"
                                : wf.successRate >= 80
                                  ? "text-yellow-400"
                                  : "text-red-400"
                            }
                          >
                            {wf.successRate}%
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(wf.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div
                            className="flex items-center justify-end gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-purple-300"
                              title="Edit"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-amber-300"
                              title={wf.status === "ACTIVE" ? "Pause" : "Activate"}
                              onClick={() => handleAction("toggle", wf.id)}
                            >
                              {wf.status === "ACTIVE" ? (
                                <Pause className="h-3.5 w-3.5" />
                              ) : (
                                <Play className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-green-300"
                              title="Run Now"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                              title="Delete"
                              onClick={() => handleAction("delete", wf.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {/* Expanded detail row */}
                      {expandedId === wf.id && (
                        <TableRow key={`${wf.id}-detail`} className="border-purple-500/10 hover:bg-transparent">
                          <TableCell colSpan={8} className="bg-purple-500/5">
                            <div className="p-4 space-y-3">
                              <div>
                                <h4 className="text-sm font-semibold mb-1">Description</h4>
                                <p className="text-sm text-muted-foreground">
                                  {wf.description || "No description provided."}
                                </p>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div>
                                  <span className="text-xs text-muted-foreground">Steps</span>
                                  <p className="text-sm font-medium">{wf.steps || "—"}</p>
                                </div>
                                <div>
                                  <span className="text-xs text-muted-foreground">Total Runs</span>
                                  <p className="text-sm font-medium">{wf.runsCount.toLocaleString()}</p>
                                </div>
                                <div>
                                  <span className="text-xs text-muted-foreground">Success Rate</span>
                                  <p className="text-sm font-medium">{wf.successRate}%</p>
                                </div>
                                <div>
                                  <span className="text-xs text-muted-foreground">Last Run</span>
                                  <p className="text-sm font-medium">
                                    {wf.lastRunAt
                                      ? new Date(wf.lastRunAt).toLocaleString()
                                      : "Never"}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden p-4 space-y-3">
              {filtered.map((wf) => (
                <Card
                  key={wf.id}
                  className="glass border-purple-500/10 p-4 card-hover"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-purple-500/20 to-violet-500/20 border border-purple-500/10 flex-shrink-0">
                        <Zap className="h-4 w-4 text-purple-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{wf.name}</p>
                        <p className="text-xs text-muted-foreground">{wf.domain}</p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] flex-shrink-0 ${STATUS_STYLES[wf.status]}`}
                    >
                      {wf.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="text-center p-2 rounded-md bg-purple-500/5">
                      <p className="text-sm font-bold">{wf.runsCount.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">Runs</p>
                    </div>
                    <div className="text-center p-2 rounded-md bg-purple-500/5">
                      <p className={`text-sm font-bold ${wf.successRate >= 95 ? "text-green-400" : wf.successRate >= 80 ? "text-yellow-400" : "text-red-400"}`}>
                        {wf.successRate}%
                      </p>
                      <p className="text-[10px] text-muted-foreground">Success</p>
                    </div>
                    <div className="text-center p-2 rounded-md bg-purple-500/5">
                      <p className="text-sm font-bold">{wf.steps || "—"}</p>
                      <p className="text-[10px] text-muted-foreground">Steps</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 h-8 text-xs text-muted-foreground hover:text-purple-300"
                    >
                      <Pencil className="mr-1 h-3 w-3" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 h-8 text-xs text-muted-foreground hover:text-amber-300"
                      onClick={() => handleAction("toggle", wf.id)}
                    >
                      {wf.status === "ACTIVE" ? (
                        <><Pause className="mr-1 h-3 w-3" />Pause</>
                      ) : (
                        <><Play className="mr-1 h-3 w-3" />Activate</>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 h-8 text-xs text-muted-foreground hover:text-green-300"
                    >
                      <RefreshCw className="mr-1 h-3 w-3" />
                      Run
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-red-400"
                      onClick={() => handleAction("delete", wf.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
