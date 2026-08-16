"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft,
  Play,
  Pause,
  Square,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Brain,
  Target,
  Zap,
  Clock,
  DollarSign,
  FileText,
  GitBranch,
  Shield,
  Wrench,
  Eye,
  Loader2,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Trash2,
  Rocket,
} from "lucide-react";
import {
  MISSION_STATUS_CONFIG,
  TASK_STATUS_CONFIG,
  RISK_LEVEL_CONFIG,
  type MissionDetail as MissionDetailType,
  type MissionTaskOutput,
  type MissionEventOutput,
  type MissionStatus,
  type MissionEventType,
} from "@/lib/mission-types";

// ─────────────────────────────────────────────
//  Animation Variants
// ─────────────────────────────────────────────

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.06 } },
};

const staggerItem = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
};

// ─────────────────────────────────────────────
//  Pulsing ring keyframes for active tasks
// ─────────────────────────────────────────────

const pulseRing = `
  @keyframes pulse-ring {
    0% { box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.5); }
    70% { box-shadow: 0 0 0 6px rgba(168, 85, 247, 0); }
    100% { box-shadow: 0 0 0 0 rgba(168, 85, 247, 0); }
  }
`;

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  if (diff < 60_000) return "just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86400_000)}d ago`;
}

/** Get the event icon component and color class based on event type / level */
function getEventIcon(event: MissionEventOutput) {
  const level = event.level || "info";

  const iconMap: Record<string, { icon: React.ReactNode; color: string }> = {
    info: { icon: <FileText className="h-4 w-4" />, color: "text-blue-400" },
    success: { icon: <CheckCircle className="h-4 w-4" />, color: "text-emerald-400" },
    warn: { icon: <AlertTriangle className="h-4 w-4" />, color: "text-amber-400" },
    error: { icon: <XCircle className="h-4 w-4" />, color: "text-red-400" },
  };

  return iconMap[level] || iconMap.info;
}

/** Determine which action buttons to show based on mission status */
function getActionButtons(status: MissionStatus): Array<{
  label: string;
  action: string;
  icon: React.ReactNode;
  variant: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  confirm?: boolean;
  confirmTitle?: string;
  confirmDescription?: string;
}> {
  switch (status) {
    case "DRAFT":
    case "PLANNING":
      return [
        {
          label: "Generate Plan",
          action: "plan",
          icon: <Brain className="h-4 w-4" />,
          variant: "default",
          confirm: true,
          confirmTitle: "Generate Execution Plan?",
          confirmDescription:
            "The AI planner will analyze your mission description and create a detailed task graph with dependencies, agent assignments, and risk assessments.",
        },
      ];
    case "AWAITING_APPROVAL":
      return [
        {
          label: "Approve Plan",
          action: "approve",
          icon: <CheckCircle className="h-4 w-4" />,
          variant: "default",
        },
        {
          label: "Reject & Re-plan",
          action: "reject",
          icon: <RotateCcw className="h-4 w-4" />,
          variant: "outline",
          confirm: true,
          confirmTitle: "Reject Current Plan?",
          confirmDescription:
            "This will discard the current plan and allow you to generate a new one. All current tasks will be removed.",
        },
      ];
    case "APPROVED":
      return [
        {
          label: "Start Execution",
          action: "execute",
          icon: <Rocket className="h-4 w-4" />,
          variant: "default",
        },
      ];
    case "EXECUTING":
      return [
        {
          label: "Pause",
          action: "pause",
          icon: <Pause className="h-4 w-4" />,
          variant: "outline",
        },
        {
          label: "Cancel",
          action: "cancel",
          icon: <Square className="h-4 w-4" />,
          variant: "destructive",
          confirm: true,
          confirmTitle: "Cancel Mission?",
          confirmDescription:
            "This will stop execution and cancel all pending and ready tasks. Running tasks will be interrupted.",
        },
      ];
    case "PAUSED":
      return [
        {
          label: "Resume",
          action: "execute",
          icon: <Play className="h-4 w-4" />,
          variant: "default",
        },
        {
          label: "Cancel",
          action: "cancel",
          icon: <Square className="h-4 w-4" />,
          variant: "destructive",
          confirm: true,
          confirmTitle: "Cancel Mission?",
          confirmDescription:
            "This will permanently cancel the mission. Pending and ready tasks will be cancelled.",
        },
      ];
    case "VERIFYING":
      return [
        {
          label: "Cancel",
          action: "cancel",
          icon: <Square className="h-4 w-4" />,
          variant: "destructive",
          confirm: true,
          confirmTitle: "Cancel Mission?",
          confirmDescription:
            "This will cancel the mission during verification. Already completed tasks will remain completed.",
        },
      ];
    case "REPAIRING":
      return [];
    case "COMPLETED":
    case "FAILED":
    case "CANCELLED":
    default:
      return [];
  }
}

/** Check if status is terminal */
function isTerminalStatus(status: MissionStatus): boolean {
  return ["COMPLETED", "FAILED", "CANCELLED"].includes(status);
}

/** Check if status is deletable */
function isDeletableStatus(status: MissionStatus): boolean {
  return ["DRAFT", "COMPLETED", "FAILED", "CANCELLED"].includes(status);
}

// ─────────────────────────────────────────────
//  Sub-Components
// ─────────────────────────────────────────────

/** Skeleton loading state for the entire view */
function MissionDetailSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* Back button */}
      <Skeleton className="h-8 w-40" />

      {/* Header */}
      <div className="space-y-3">
        <Skeleton className="h-8 w-3/4" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      </div>

      {/* Action bar */}
      <Skeleton className="h-10 w-64" />

      {/* Progress dashboard */}
      <Skeleton className="h-32 w-full rounded-xl" />

      {/* Plan display */}
      <Skeleton className="h-48 w-full rounded-xl" />

      {/* Task graph */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>

      {/* Activity feed */}
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

/** Not-found state */
function MissionNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
        <XCircle className="h-8 w-8 text-red-400" />
      </div>
      <h2 className="text-xl font-bold mb-2">Mission Not Found</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        The mission you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it. It may have been deleted or the link may be incorrect.
      </p>
    </div>
  );
}

/** Single task card within the task graph */
function TaskCard({
  task,
  taskMap,
  index,
  totalTasks,
  expandedTask,
  onToggleExpand,
}: {
  task: MissionTaskOutput;
  taskMap: Map<string, MissionTaskOutput>;
  index: number;
  totalTasks: number;
  expandedTask: string | null;
  onToggleExpand: (taskId: string) => void;
}) {
  const isExpanded = expandedTask === task.id;
  const isRunning = task.status === "RUNNING";
  const isCompleted = task.status === "COMPLETED";
  const isFailed = task.status === "FAILED";
  const isActive = isRunning || task.status === "READY";
  const statusCfg = TASK_STATUS_CONFIG[task.status];
  const riskCfg = RISK_LEVEL_CONFIG[task.riskLevel];

  // Dependency display: find titles of dependency tasks
  const depTitles = task.dependencies
    .map((depId) => {
      const dep = taskMap.get(depId);
      if (!dep) return null;
      const depIdx = dep.order + 1;
      return { id: depId, label: `Task ${depIdx}`, title: dep.title };
    })
    .filter(Boolean) as Array<{ id: string; label: string; title: string }>;

  const hasDeps = depTitles.length > 0;
  const isFirst = task.dependencies.length === 0;

  return (
    <motion.div
      {...staggerItem}
      className="relative"
    >
      {/* Dependency arrow line (connects to previous dependency) */}
      {hasDeps && (
        <div className="flex items-center gap-2 mb-2 pl-2">
          <GitBranch className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            Depends on:{" "}
            {depTitles.map((d, i) => (
              <span key={d.id} className="text-purple-400 font-medium">
                {d.label}
                {i < depTitles.length - 1 && ", "}
              </span>
            ))}
          </span>
        </div>
      )}

      {/* Start connector dot */}
      {isFirst && index > 0 && (
        <div className="absolute -top-3 left-6 z-10 h-3 w-3 rounded-full bg-purple-500/30 border-2 border-purple-500/50" />
      )}

      <motion.div
        className={`
          group relative rounded-xl border p-4 transition-all cursor-pointer
          ${isRunning
            ? "border-purple-500/60 bg-purple-500/5"
            : isCompleted
              ? "border-emerald-500/30 bg-emerald-500/5"
              : isFailed
                ? "border-red-500/30 bg-red-500/5"
                : "border-border/50 bg-card/50 hover:border-border"
          }
        `}
        style={isRunning ? { animation: "pulse-ring 2s ease-in-out infinite" } : undefined}
        onClick={() => onToggleExpand(task.id)}
        whileHover={{ scale: 1.005 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      >
        {/* Status overlay icons */}
        {isCompleted && (
          <div className="absolute top-3 right-3">
            <CheckCircle className="h-5 w-5 text-emerald-400" />
          </div>
        )}
        {isFailed && (
          <div className="absolute top-3 right-3 flex items-center gap-1">
            <XCircle className="h-5 w-5 text-red-400" />
            {task.retryCount > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-500/30 text-red-400">
                {task.retryCount}/{task.maxRetries}
              </Badge>
            )}
          </div>
        )}
        {isRunning && (
          <div className="absolute top-3 right-3">
            <Loader2 className="h-5 w-5 text-purple-400 animate-spin" />
          </div>
        )}

        {/* Task number + title row */}
        <div className="flex items-start gap-3 pr-10">
          <div
            className={`
              flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold
              ${isCompleted ? "bg-emerald-500/20 text-emerald-400" : isFailed ? "bg-red-500/20 text-red-400" : isRunning ? "bg-purple-500/20 text-purple-400" : "bg-secondary text-secondary-foreground"}
            `}
          >
            {task.order + 1}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-sm leading-tight">{task.title}</h4>
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 ${statusCfg.color} ${statusCfg.bgColor} border-current/20`}
              >
                {statusCfg.label}
              </Badge>
            </div>

            {/* Agent + team + risk row */}
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {task.assignedAgent && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Zap className="h-3 w-3" />
                  {task.assignedAgent}
                  {task.agentTeam && (
                    <span className="text-muted-foreground/60">· {task.agentTeam}</span>
                  )}
                </span>
              )}
              {task.agentRole && (
                <span className="text-[10px] text-muted-foreground/60 bg-secondary/50 px-1.5 py-0.5 rounded">
                  {task.agentRole}
                </span>
              )}
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${riskCfg.dotColor}`}
                />
                <span className={riskCfg.color}>{riskCfg.label}</span>
              </span>
              {task.approvalStatus === "PENDING" && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/50 text-amber-400 bg-amber-500/10">
                  <Clock className="h-2.5 w-2.5 mr-0.5" />
                  Needs Approval
                </Badge>
              )}
              {task.approvalStatus === "APPROVED" && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-500/50 text-green-400 bg-green-500/10">
                  <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
                  Approved
                </Badge>
              )}
            </div>
          </div>

          {/* Expand toggle */}
          <div className="shrink-0 flex items-center">
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </motion.div>
          </div>
        </div>

        {/* Progress indicator for running tasks */}
        {isRunning && (
          <div className="mt-3 ml-11">
            <div className="h-1.5 w-full rounded-full bg-purple-500/20 overflow-hidden">
              <motion.div
                className="h-full bg-purple-500 rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: "60%" }}
                transition={{ duration: 2, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
              />
            </div>
          </div>
        )}

        {/* Expanded content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <Separator className="my-3" />
              <div className="space-y-3 text-sm">
                {/* Description */}
                {task.description && (
                  <div>
                    <p className="text-muted-foreground">{task.description}</p>
                  </div>
                )}

                {/* Required tools */}
                {task.requiredTools.length > 0 && (
                  <div className="flex items-start gap-2">
                    <Wrench className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex flex-wrap gap-1.5">
                      {task.requiredTools.map((tool) => (
                        <Badge
                          key={tool}
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0"
                        >
                          {tool}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Input */}
                {task.input && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 font-medium">
                      Input Context
                    </p>
                    <pre className="text-xs bg-secondary/50 rounded-lg p-2 overflow-x-auto max-h-32 text-muted-foreground whitespace-pre-wrap">
                      {task.input.length > 500 ? task.input.slice(0, 500) + "..." : task.input}
                    </pre>
                  </div>
                )}

                {/* Output */}
                {task.output && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 font-medium">
                      Output {task.outputType && <span className="opacity-60">({task.outputType})</span>}
                    </p>
                    <pre className="text-xs bg-secondary/50 rounded-lg p-2 overflow-x-auto max-h-32 text-muted-foreground whitespace-pre-wrap">
                      {task.output.length > 500 ? task.output.slice(0, 500) + "..." : task.output}
                    </pre>
                  </div>
                )}

                {/* Verification result */}
                {task.verificationResult && (
                  <div className="flex items-start gap-2">
                    <Shield className="h-4 w-4 shrink-0 mt-0.5 text-cyan-400" />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        Verification
                      </p>
                      <p className={`text-xs mt-0.5 ${task.verificationStatus === "PASSED" ? "text-emerald-400" : "text-red-400"}`}>
                        {task.verificationResult}
                      </p>
                    </div>
                  </div>
                )}

                {/* Timing info */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                  {task.startedAt && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Started: {formatDate(task.startedAt)}
                    </span>
                  )}
                  {task.completedAt && (
                    <span className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Completed: {formatDate(task.completedAt)}
                    </span>
                  )}
                  {task.durationMs !== null && (
                    <span className="flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      Duration: {formatDuration(task.durationMs)}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Connector line to next task */}
      {index < totalTasks - 1 && (
        <div className="flex justify-center">
          <div className={`w-0.5 h-4 ${isCompleted ? "bg-emerald-500/40" : isRunning ? "bg-purple-500/40" : "bg-border/40"}`} />
        </div>
      )}
    </motion.div>
  );
}

/** Status mini-chart (colored bars showing task counts by status) */
function TaskStatusChart({ tasks }: { tasks: MissionTaskOutput[] }) {
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of tasks) {
      c[t.status] = (c[t.status] || 0) + 1;
    }
    return c;
  }, [tasks]);

  const bars = [
    { status: "COMPLETED" as const, color: "bg-emerald-500" },
    { status: "RUNNING" as const, color: "bg-purple-500" },
    { status: "READY" as const, color: "bg-blue-500" },
    { status: "FAILED" as const, color: "bg-red-500" },
    { status: "PENDING" as const, color: "bg-gray-500" },
    { status: "SKIPPED" as const, color: "bg-gray-400" },
    { status: "CANCELLED" as const, color: "bg-gray-600" },
  ];

  const total = tasks.length || 1;

  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full bg-secondary/30">
      {bars.map(({ status, color }) => {
        const count = counts[status] || 0;
        if (count === 0) return null;
        return (
          <Tooltip key={status}>
            <TooltipTrigger asChild>
              <motion.div
                className={`${color} h-full`}
                initial={{ width: 0 }}
                animate={{ width: `${(count / total) * 100}%` }}
                transition={{ duration: 0.5, delay: 0.2 }}
              />
            </TooltipTrigger>
            <TooltipContent>
              {TASK_STATUS_CONFIG[status].label}: {count}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
//  Main Component
// ─────────────────────────────────────────────

export function MissionDetail() {
  const { selectedMissionId, navigate } = useApp();
  const { data: session } = useSession();

  const [mission, setMission] = useState<MissionDetailType | null>(null);
  const [events, setEvents] = useState<MissionEventOutput[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: string;
  } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const isLive = mission && ["EXECUTING", "PLANNING", "VERIFYING", "REPAIRING"].includes(mission.status);

  // ─────────────────────────────────────────────
  //  Fetch mission data
  // ─────────────────────────────────────────────

  const fetchMission = useCallback(async () => {
    if (!selectedMissionId) return;

    try {
      const res = await fetch(`/api/missions/${selectedMissionId}`);
      if (res.status === 404) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch mission");

      const data = await res.json();
      setMission(data.mission || data);
    } catch (err) {
      console.error("Failed to fetch mission:", err);
      toast.error("Failed to load mission data");
    } finally {
      setLoading(false);
    }
  }, [selectedMissionId]);

  const fetchEvents = useCallback(async () => {
    if (!selectedMissionId) return;

    try {
      const res = await fetch(`/api/missions/${selectedMissionId}?action=events&limit=50`);
      if (!res.ok) return;
      const data = await res.json();
      setEvents(data.events || []);
    } catch {
      // Silently ignore event fetch errors
    }
  }, [selectedMissionId]);

  // ─────────────────────────────────────────────
  //  Initial load + polling for live missions
  // ─────────────────────────────────────────────

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    setExpandedTask(null);
    fetchMission();
    fetchEvents();

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [fetchMission, fetchEvents]);

  // Poll when mission is live
  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    if (isLive) {
      pollRef.current = setInterval(() => {
        fetchMission();
        fetchEvents();
      }, 3000);
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [isLive, fetchMission, fetchEvents]);

  // ─────────────────────────────────────────────
  //  SSE connection for live mission updates
  // ─────────────────────────────────────────────

  const sseRef = useRef<EventSource | null>(null);

  const connectSSE = useCallback((missionId: string) => {
    // Close existing connection
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }

    const eventSource = new EventSource(`/api/missions/${missionId}/stream`);
    sseRef.current = eventSource;

    eventSource.addEventListener("connected", () => {
      console.log("[SSE] Connected to mission stream");
    });

    eventSource.addEventListener("task_update", (e) => {
      try {
        const data = JSON.parse(e.data);
        // Refresh mission to get updated task states
        fetchMission();
        fetchEvents();
      } catch {
        // ignore parse errors
      }
    });

    eventSource.addEventListener("heartbeat", (e) => {
      try {
        const data = JSON.parse(e.data);
        // Update mission progress without full refresh
        setMission((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            status: data.status || prev.status,
            progress: data.progress ?? prev.progress,
            completedTasks: data.completedTasks ?? prev.completedTasks,
            failedTasks: data.failedTasks ?? prev.failedTasks,
            spentUsd: data.spentUsd ?? prev.spentUsd,
          };
        });
      } catch {
        // ignore
      }
    });

    eventSource.addEventListener("mission_completed", () => {
      toast.success("Mission completed successfully!");
      fetchMission();
      fetchEvents();
      eventSource.close();
      sseRef.current = null;
    });

    eventSource.addEventListener("mission_failed", (e) => {
      try {
        const data = JSON.parse(e.data);
        toast.error("Mission failed", {
          description: `${data.completedTasks}/${data.totalTasks} tasks completed before failure`,
        });
      } catch {
        toast.error("Mission failed");
      }
      fetchMission();
      fetchEvents();
      eventSource.close();
      sseRef.current = null;
    });

    eventSource.addEventListener("mission_cancelled", () => {
      toast.info("Mission was cancelled");
      fetchMission();
      fetchEvents();
      eventSource.close();
      sseRef.current = null;
    });

    eventSource.addEventListener("error", () => {
      console.log("[SSE] Connection error or closed");
      eventSource.close();
      sseRef.current = null;
    });

    eventSource.onerror = () => {
      eventSource.close();
      sseRef.current = null;
    };
  }, [fetchMission, fetchEvents]);

  // Connect SSE when mission is in live state
  useEffect(() => {
    if (isLive && selectedMissionId && !sseRef.current) {
      connectSSE(selectedMissionId);
    }

    return () => {
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
    };
  }, [isLive, selectedMissionId, connectSSE]);

  // ─────────────────────────────────────────────
  //  Action handlers
  // ─────────────────────────────────────────────

  const handleAction = useCallback(
    async (action: string) => {
      if (!selectedMissionId) return;
      setActionLoading(action);

      try {
        // Route execution to the dedicated /run endpoint
        if (action === "execute") {
          const res = await fetch(`/api/missions/${selectedMissionId}/run`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "full" }),
          });

          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.error || data.details || "Execution failed");
          }

          toast.success("Mission execution started!", {
            description: "Tasks are being executed. You can see live progress below.",
          });

          // Connect to SSE stream for live updates
          connectSSE(selectedMissionId);
          await fetchMission();
          await fetchEvents();
        } else {
          // All other actions go through the standard missions endpoint
          const res = await fetch(`/api/missions/${selectedMissionId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action }),
          });

          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.error || data.details || "Action failed");
          }

          toast.success(data.message || `Mission ${action} successful`);
          await fetchMission();
          await fetchEvents();
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Action failed";
        toast.error(message);
      } finally {
        setActionLoading(null);
        setConfirmDialog(null);
      }
    },
    [selectedMissionId, fetchMission, fetchEvents],
  );

  const handleDelete = useCallback(async () => {
    if (!selectedMissionId) return;
    setActionLoading("delete");

    try {
      const res = await fetch(`/api/missions/${selectedMissionId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete mission");
      }

      toast.success("Mission deleted successfully");
      setDeleteDialogOpen(false);
      navigate("missions");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete mission";
      toast.error(message);
    } finally {
      setActionLoading(null);
    }
  }, [selectedMissionId, navigate]);

  // ─────────────────────────────────────────────
  //  Derived data
  // ─────────────────────────────────────────────

  const sortedTasks = useMemo(() => {
    if (!mission?.tasks) return [];
    return [...mission.tasks].sort((a, b) => a.order - b.order);
  }, [mission]);

  const taskMap = useMemo(() => {
    const map = new Map<string, MissionTaskOutput>();
    for (const t of sortedTasks) map.set(t.id, t);
    return map;
  }, [sortedTasks]);

  const actionButtons = useMemo(() => {
    if (!mission) return [];
    return getActionButtons(mission.status);
  }, [mission]);

  const parsedPlan = useMemo(() => {
    if (!mission?.planJson) return null;
    try {
      return JSON.parse(mission.planJson);
    } catch {
      return null;
    }
  }, [mission?.planJson]);

  const budgetPercent = useMemo(() => {
    if (!mission) return 0;
    if (!mission.budgetUsd) return mission.spentUsd > 0 ? 100 : 0;
    return Math.min((mission.spentUsd / mission.budgetUsd) * 100, 100);
  }, [mission]);

  // ─────────────────────────────────────────────
  //  Render: Loading
  // ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto">
        <MissionDetailSkeleton />
      </div>
    );
  }

  // ─────────────────────────────────────────────
  //  Render: Not found
  // ─────────────────────────────────────────────

  if (notFound || !mission) {
    return (
      <div className="max-w-5xl mx-auto">
        <MissionNotFound />
      </div>
    );
  }

  const statusCfg = MISSION_STATUS_CONFIG[mission.status];
  const isPriorityHigh = mission.priority === "HIGH" || mission.priority === "CRITICAL";

  // ─────────────────────────────────────────────
  //  Render: Main Content
  // ─────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto">
      {/* Inject pulse keyframes for active tasks */}
      <style dangerouslySetInnerHTML={{ __html: pulseRing }} />

      <motion.div
        className="space-y-6 p-6"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        {/* ─── Back Button ─── */}
        <motion.div {...fadeIn}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("missions")}
            className="text-muted-foreground hover:text-foreground -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Missions
          </Button>
        </motion.div>

        {/* ─── Mission Header ─── */}
        <motion.div {...fadeIn} className="space-y-3">
          <div className="flex items-start gap-4 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold leading-tight flex-1 min-w-0">
              {mission.title}
            </h1>
            {/* Live indicator */}
            {isLive && (
              <span className="flex items-center gap-1.5 text-xs text-purple-400 shrink-0">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
                </span>
                Live
              </span>
            )}
          </div>

          {/* Badges row */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className={`${statusCfg.color} ${statusCfg.bgColor} border-current/20 text-xs`}
            >
              {statusCfg.label}
            </Badge>
            <Badge
              variant="outline"
              className={`text-xs ${isPriorityHigh ? "text-amber-400 bg-amber-500/20 border-amber-400/20" : "text-muted-foreground bg-secondary/50 border-border/50"}`}
            >
              <Target className="h-3 w-3 mr-1" />
              {mission.priority}
            </Badge>
            {mission.budgetUsd && (
              <Badge
                variant="outline"
                className={`text-xs ${budgetPercent > 80 ? "text-red-400 bg-red-500/20 border-red-400/20" : "text-muted-foreground bg-secondary/50 border-border/50"}`}
              >
                <DollarSign className="h-3 w-3 mr-1" />
                {formatCurrency(mission.spentUsd)} / {formatCurrency(mission.budgetUsd)}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Created {formatDate(mission.createdAt)}
            </span>
          </div>

          {/* Description */}
          {mission.description && (
            <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
              {mission.description}
            </p>
          )}
        </motion.div>

        {/* ─── Action Buttons Bar ─── */}
        {(actionButtons.length > 0 || isDeletableStatus(mission.status)) && (
          <motion.div {...fadeIn}>
            <Card className="py-3 px-4">
              <CardContent className="flex items-center gap-2 flex-wrap p-0">
                {actionButtons.map((btn) => {
                  const isLoading = actionLoading === btn.action;

                  if (btn.confirm) {
                    return (
                      <Button
                        key={btn.action}
                        variant={btn.variant}
                        size="sm"
                        disabled={!!actionLoading}
                        onClick={() =>
                          setConfirmDialog({
                            open: true,
                            title: btn.confirmTitle || "Confirm Action",
                            description: btn.confirmDescription || "Are you sure?",
                            action: btn.action,
                          })
                        }
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          btn.icon
                        )}
                        {btn.label}
                      </Button>
                    );
                  }

                  return (
                    <Button
                      key={btn.action}
                      variant={btn.variant}
                      size="sm"
                      disabled={!!actionLoading}
                      onClick={() => handleAction(btn.action)}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        btn.icon
                      )}
                      {btn.label}
                    </Button>
                  );
                })}

                {isDeletableStatus(mission.status) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!!actionLoading}
                    onClick={() => setDeleteDialogOpen(true)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 ml-auto"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Mission
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ─── Plan Display ─── */}
        {parsedPlan && (
          <motion.div {...fadeIn}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-purple-400" />
                  <CardTitle className="text-base">Execution Plan</CardTitle>
                </div>
                {parsedPlan.summary && (
                  <CardDescription>{parsedPlan.summary}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Plan reasoning */}
                {parsedPlan.reasoning && (
                  <div className="rounded-lg bg-secondary/50 p-3">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {parsedPlan.reasoning}
                    </p>
                  </div>
                )}

                {/* Plan stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="text-center p-3 rounded-lg bg-secondary/30">
                    <p className="text-2xl font-bold text-foreground">
                      {parsedPlan.tasks?.length || mission.totalTasks}
                    </p>
                    <p className="text-xs text-muted-foreground">Tasks</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-secondary/30">
                    <p className="text-2xl font-bold text-foreground">
                      {parsedPlan.estimatedCostUsd != null
                        ? formatCurrency(parsedPlan.estimatedCostUsd)
                        : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">Est. Cost</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-secondary/30">
                    <p className="text-2xl font-bold text-foreground">
                      {parsedPlan.tools?.length || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Tools</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-secondary/30">
                    <Badge
                      variant="outline"
                      className={`${RISK_LEVEL_CONFIG[parsedPlan.riskAssessment]?.color || RISK_LEVEL_CONFIG.MEDIUM.color} ${RISK_LEVEL_CONFIG[parsedPlan.riskAssessment]?.bgColor || RISK_LEVEL_CONFIG.MEDIUM.bgColor} border-current/20`}
                    >
                      {RISK_LEVEL_CONFIG[parsedPlan.riskAssessment]?.label || parsedPlan.riskAssessment}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">Risk Level</p>
                  </div>
                </div>

                {/* Agent assignments summary */}
                {parsedPlan.agents && parsedPlan.agents.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Agent Assignments
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {parsedPlan.agents.map((agent: { name: string; team: string; role: string; tasks: string[] }) => (
                        <Tooltip key={agent.name}>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/50 px-3 py-1.5">
                              <Zap className="h-3.5 w-3.5 text-purple-400" />
                              <span className="text-xs font-medium">{agent.name}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {agent.role}
                              </span>
                              <Badge
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0"
                              >
                                {agent.tasks?.length || 0} tasks
                              </Badge>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-medium">{agent.name}</p>
                            <p className="text-muted-foreground">
                              Team: {agent.team} · Role: {agent.role}
                            </p>
                            <p className="text-muted-foreground">
                              Tasks: {agent.tasks?.length || 0}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ─── Progress Dashboard ─── */}
        <motion.div {...fadeIn}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-purple-400" />
                Progress Dashboard
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Overall progress */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium">Mission Progress</span>
                  <span className="text-sm text-muted-foreground">
                    {mission.progress}% — {mission.completedTasks}/{mission.totalTasks} tasks
                  </span>
                </div>
                <Progress value={mission.progress} className="h-2.5" />
              </div>

              {/* Status breakdown mini-chart */}
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Task Status Breakdown</p>
                <TaskStatusChart tasks={sortedTasks} />
                <div className="flex flex-wrap gap-3 mt-2">
                  {(["COMPLETED", "RUNNING", "READY", "PENDING", "FAILED", "SKIPPED", "CANCELLED"] as const).map(
                    (status) => {
                      const count = sortedTasks.filter((t) => t.status === status).length;
                      if (count === 0) return null;
                      const cfg = TASK_STATUS_CONFIG[status];
                      return (
                        <span
                          key={status}
                          className={`text-xs ${cfg.color}`}
                        >
                          {cfg.label}: {count}
                        </span>
                      );
                    },
                  )}
                </div>
              </div>

              {/* Budget consumption */}
              {mission.budgetUsd !== null && mission.budgetUsd > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium flex items-center gap-1">
                      <DollarSign className="h-3.5 w-3.5" />
                      Budget
                    </span>
                    <span className={`text-sm ${budgetPercent > 80 ? "text-red-400" : "text-muted-foreground"}`}>
                      {formatCurrency(mission.spentUsd)} / {formatCurrency(mission.budgetUsd)} ({budgetPercent.toFixed(0)}%)
                    </span>
                  </div>
                  <Progress
                    value={budgetPercent}
                    className={`h-2 ${budgetPercent > 80 ? "[&>[data-slot=progress-indicator]]:bg-red-500" : ""}`}
                  />
                  {budgetPercent > 80 && (
                    <Alert className="mt-2 border-amber-500/30 bg-amber-500/5">
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                      <AlertTitle className="text-amber-400 text-xs">Budget Warning</AlertTitle>
                      <AlertDescription className="text-xs text-muted-foreground">
                        You&apos;ve used {budgetPercent.toFixed(0)}% of your budget. Consider pausing if costs exceed expectations.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {/* Quick stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div className="text-center">
                  <p className="text-lg font-bold text-emerald-400">{mission.completedTasks}</p>
                  <p className="text-[10px] text-muted-foreground">Completed</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-purple-400">
                    {sortedTasks.filter((t) => t.status === "RUNNING").length}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Running</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-red-400">{mission.failedTasks}</p>
                  <p className="text-[10px] text-muted-foreground">Failed</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-muted-foreground">
                    {mission.totalTasks - mission.completedTasks - mission.failedTasks}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Remaining</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ─── Task Graph ─── */}
        <motion.div {...fadeIn}>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-purple-400" />
                  Task Graph
                  <Badge variant="secondary" className="text-xs ml-1">
                    {sortedTasks.length} task{sortedTasks.length !== 1 ? "s" : ""}
                  </Badge>
                </CardTitle>
                {sortedTasks.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground"
                    onClick={() => setExpandedTask(expandedTask ? null : sortedTasks[0]?.id || null)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    {expandedTask ? "Collapse All" : "Expand First"}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {sortedTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <GitBranch className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground font-medium">No tasks yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {mission.status === "DRAFT"
                      ? "Generate a plan to create the task graph."
                      : "Tasks will appear here once a plan is generated."}
                  </p>
                </div>
              ) : (
                <ScrollArea className="max-h-[600px]">
                  <div className="space-y-1 pr-2">
                    {sortedTasks.map((task, index) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        taskMap={taskMap}
                        index={index}
                        totalTasks={sortedTasks.length}
                        expandedTask={expandedTask}
                        onToggleExpand={setExpandedTask}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* ─── Activity Feed (collapsible) ─── */}
        <motion.div {...fadeIn}>
          <Card>
            <CardHeader className="pb-0">
              <button
                type="button"
                className="w-full flex items-center justify-between"
                onClick={() => setEventsOpen(!eventsOpen)}
              >
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-purple-400" />
                  Activity Feed
                  {events.length > 0 && (
                    <Badge variant="secondary" className="text-xs ml-1">
                      {events.length}
                    </Badge>
                  )}
                </CardTitle>
                <motion.div
                  animate={{ rotate: eventsOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                </motion.div>
              </button>
            </CardHeader>
            <AnimatePresence>
              {eventsOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <CardContent className="pt-4">
                    {events.length === 0 ? (
                      <div className="flex flex-col items-center py-8 text-center">
                        <FileText className="h-8 w-8 text-muted-foreground/30 mb-2" />
                        <p className="text-sm text-muted-foreground">No activity yet</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">
                          Events will appear here as the mission progresses.
                        </p>
                      </div>
                    ) : (
                      <ScrollArea className="max-h-96">
                        <div className="relative space-y-0 pl-4">
                          {/* Timeline line */}
                          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border/50" />

                          {events.map((event, idx) => {
                            const { icon, color } = getEventIcon(event);
                            return (
                              <motion.div
                                key={event.id}
                                {...staggerItem}
                                className="relative flex gap-3 pb-4 last:pb-0"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: idx * 0.03 }}
                              >
                                {/* Timeline dot */}
                                <div className="relative z-10 mt-0.5">
                                  <div className={`h-[15px] w-[15px] rounded-full border-2 border-border bg-background flex items-center justify-center ${color}`}>
                                    <div className="scale-75">{icon}</div>
                                  </div>
                                </div>

                                {/* Event content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-medium truncate">
                                      {event.title}
                                    </p>
                                    <span className="text-[10px] text-muted-foreground shrink-0">
                                      {timeAgo(event.createdAt)}
                                    </span>
                                  </div>
                                  {event.description && (
                                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                      {event.description}
                                    </p>
                                  )}
                                  {event.eventType && (
                                    <Badge
                                      variant="secondary"
                                      className="text-[10px] px-1.5 py-0 mt-1"
                                    >
                                      {event.eventType}
                                    </Badge>
                                  )}
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>

        {/* ─── Terminal State Banner ─── */}
        {isTerminalStatus(mission.status) && (
          <motion.div {...fadeIn}>
            <Alert
              className={
                mission.status === "COMPLETED"
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : mission.status === "FAILED"
                    ? "border-red-500/30 bg-red-500/5"
                    : "border-border/50 bg-secondary/30"
              }
            >
              {mission.status === "COMPLETED" ? (
                <CheckCircle className="h-4 w-4 text-emerald-400" />
              ) : mission.status === "FAILED" ? (
                <AlertTriangle className="h-4 w-4 text-red-400" />
              ) : (
                <XCircle className="h-4 w-4 text-muted-foreground" />
              )}
              <AlertTitle
                className={
                  mission.status === "COMPLETED"
                    ? "text-emerald-400"
                    : mission.status === "FAILED"
                      ? "text-red-400"
                      : ""
                }
              >
                {mission.status === "COMPLETED"
                  ? "Mission Completed Successfully"
                  : mission.status === "FAILED"
                    ? "Mission Failed"
                    : "Mission Cancelled"}
              </AlertTitle>
              <AlertDescription>
                {mission.status === "COMPLETED"
                  ? `All ${mission.totalTasks} tasks completed successfully. Total cost: ${formatCurrency(mission.spentUsd)}.`
                  : mission.status === "FAILED"
                    ? `Mission failed after ${mission.failedTasks} task failure(s). You can review the task graph above for details.`
                    : "This mission was cancelled. You can safely delete it from the actions above."}
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </motion.div>

      {/* ─── Confirm Action Dialog ─── */}
      <AlertDialog
        open={confirmDialog?.open || false}
        onOpenChange={(open) => {
          if (!open) setConfirmDialog(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog?.title || "Confirm Action"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog?.description || "Are you sure you want to proceed?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDialog(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDialog?.action) handleAction(confirmDialog.action);
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Delete Mission Dialog ─── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Mission</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{mission.title}&quot; and all associated tasks,
              events, and data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {actionLoading === "delete" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
