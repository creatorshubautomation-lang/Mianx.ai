"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "@/lib/store";
import type { MissionListItem, MissionStatus } from "@/lib/mission-types";
import { MISSION_STATUS_CONFIG } from "@/lib/mission-types";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Rocket,
  Plus,
  Play,
  Pause,
  CheckCircle,
  AlertTriangle,
  Target,
  Zap,
  Brain,
  Clock,
  DollarSign,
  Filter,
  Search,
  Loader2,
  CalendarDays,
  FileEdit,
  ShieldCheck,
  Wrench,
  Trophy,
  XCircle,
} from "lucide-react";

// ─────────────────────────────────────────────
//  Icon mapping for status badges
// ─────────────────────────────────────────────

const STATUS_ICON_MAP: Record<string, React.ElementType> = {
  FileEdit,
  Brain,
  Clock,
  CheckCircle,
  Play,
  Pause,
  ShieldCheck,
  Wrench,
  Trophy,
  AlertTriangle,
  XCircle,
};

// ─────────────────────────────────────────────
//  Animated counter hook
// ─────────────────────────────────────────────

function useAnimatedCounter(target: number, duration = 800) {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number>(0);
  const snapRef = useRef({ target, count: 0 });

  useEffect(() => {
    const snap = snapRef.current;
    const from = snap.count;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(from + (target - from) * eased);
      snap.count = next;
      setCount(next);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    snapRef.current = { target, count: target };
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return count;
}

// ─────────────────────────────────────────────
//  Status icon component
// ─────────────────────────────────────────────

function StatusIcon({ status }: { status: MissionStatus }) {
  const config = MISSION_STATUS_CONFIG[status];
  const Icon = STATUS_ICON_MAP[config.icon] || Zap;
  const isAnimated = ["EXECUTING", "PLANNING", "VERIFYING", "REPAIRING"].includes(
    status,
  );

  return (
    <span className={config.color}>
      <Icon
        className={`h-3.5 w-3.5 ${isAnimated ? "animate-pulse" : ""}`}
      />
    </span>
  );
}

// ─────────────────────────────────────────────
//  Budget bar sub-component
// ─────────────────────────────────────────────

function BudgetBar({
  spent,
  budget,
}: {
  spent: number;
  budget: number | null;
}) {
  if (!budget && spent === 0) return null;

  const pct = budget ? Math.min((spent / budget) * 100, 100) : 0;
  const isOver = budget ? spent > budget : false;

  return (
    <div className="flex items-center gap-2 mt-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground w-full">
            <DollarSign className="h-3 w-3 shrink-0" />
            <div className="flex-1">
              <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${
                    isOver
                      ? "bg-red-500"
                      : pct > 80
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(pct, 100)}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </div>
            <span className="shrink-0 tabular-nums">
              ${spent.toFixed(2)}
              {budget ? ` / $${budget.toFixed(2)}` : ""}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {isOver
            ? `Over budget by $${((spent ?? 0) - (budget ?? 0)).toFixed(2)}`
            : budget
              ? `$${(budget - spent).toFixed(2)} remaining`
              : `$${spent.toFixed(2)} spent (no limit)`}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Filter pill definitions
// ─────────────────────────────────────────────

type FilterKey = "all" | "draft" | "planning" | "active" | "completed" | "failed";

const FILTERS: { key: FilterKey; label: string; statuses: MissionStatus[] }[] = [
  { key: "all", label: "All", statuses: [] },
  { key: "draft", label: "Draft", statuses: ["DRAFT"] },
  { key: "planning", label: "Planning", statuses: ["PLANNING", "AWAITING_APPROVAL", "APPROVED"] },
  { key: "active", label: "Active", statuses: ["EXECUTING", "PLANNING", "VERIFYING", "REPAIRING"] },
  { key: "completed", label: "Completed", statuses: ["COMPLETED"] },
  { key: "failed", label: "Failed", statuses: ["FAILED", "CANCELLED"] },
];

// ─────────────────────────────────────────────
//  Create Mission Dialog
// ─────────────────────────────────────────────

function CreateMissionDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const { data: session } = useSession();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<string>("normal");
  const [budgetUsd, setBudgetUsd] = useState("");
  const [deadline, setDeadline] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const resetForm = useCallback(() => {
    setTitle("");
    setDescription("");
    setPriority("normal");
    setBudgetUsd("");
    setDeadline("");
    setError("");
  }, []);

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      setError("Title and description are required.");
      return;
    }
    if (title.length > 200) {
      setError("Title must be under 200 characters.");
      return;
    }
    if (description.length > 5000) {
      setError("Description must be under 5000 characters.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          priority,
          budgetUsd: budgetUsd ? parseFloat(budgetUsd) : null,
          deadline: deadline || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create mission");
      }

      resetForm();
      onOpenChange(false);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="glass-strong border-purple-500/20 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <Rocket className="h-5 w-5 text-purple-400" />
            Launch New Mission
          </DialogTitle>
          <DialogDescription>
            Define an objective and let the AI planner build an autonomous
            execution plan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="mission-title" className="text-sm font-medium">
              Mission Title <span className="text-red-400">*</span>
            </Label>
            <Input
              id="mission-title"
              placeholder="e.g. Build a customer onboarding flow"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 200))}
              maxLength={200}
              className="glass bg-white/5"
            />
            <p className="text-xs text-muted-foreground text-right">
              {title.length}/200
            </p>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="mission-desc" className="text-sm font-medium">
              Description <span className="text-red-400">*</span>
            </Label>
            <Textarea
              id="mission-desc"
              placeholder="Describe what you want the AI agents to accomplish. Be specific about requirements, constraints, and desired outcomes..."
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 5000))}
              maxLength={5000}
              rows={4}
              className="glass bg-white/5 resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">
              {description.length}/5000
            </p>
          </div>

          {/* Priority + Budget row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="glass bg-white/5 w-full">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent className="glass-strong border-purple-500/20">
                  <SelectItem value="low">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      Low
                    </span>
                  </SelectItem>
                  <SelectItem value="normal">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-blue-400" />
                      Normal
                    </span>
                  </SelectItem>
                  <SelectItem value="high">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-400" />
                      High
                    </span>
                  </SelectItem>
                  <SelectItem value="critical">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-red-400" />
                      Critical
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mission-budget" className="text-sm font-medium">
                Budget Limit (USD)
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="mission-budget"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="No limit"
                  value={budgetUsd}
                  onChange={(e) => setBudgetUsd(e.target.value)}
                  className="glass bg-white/5 pl-9"
                />
              </div>
            </div>
          </div>

          {/* Deadline */}
          <div className="space-y-1.5">
            <Label htmlFor="mission-deadline" className="text-sm font-medium">
              <CalendarDays className="h-3.5 w-3.5 inline mr-1.5" />
              Deadline (optional)
            </Label>
            <Input
              id="mission-deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="glass bg-white/5"
            />
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="glass"
            onClick={() => {
              resetForm();
              onOpenChange(false);
            }}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !title.trim() || !description.trim()}
            className="btn-gradient text-white min-w-[120px]"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Launching...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Launch Mission
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
//  Skeleton loading cards
// ─────────────────────────────────────────────

function MissionCardSkeleton() {
  return (
    <div className="glass-strong border-purple-500/10 rounded-xl p-5 space-y-3">
      <div className="flex items-start justify-between">
        <Skeleton className="h-5 w-3/5 rounded-md" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-4 w-full rounded-md" />
      <Skeleton className="h-4 w-2/3 rounded-md" />
      <div className="flex items-center gap-4 mt-2">
        <Skeleton className="h-1.5 flex-1 rounded-full" />
      </div>
      <div className="flex items-center gap-4">
        <Skeleton className="h-3 w-16 rounded" />
        <Skeleton className="h-3 w-20 rounded" />
        <Skeleton className="h-3 w-14 rounded" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Empty state
// ─────────────────────────────────────────────

function EmptyState({ onCreateNew }: { onCreateNew: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="glass-strong border-purple-500/10 rounded-2xl p-12 sm:p-16 text-center"
    >
      {/* Decorative rocket illustration */}
      <div className="relative mx-auto w-32 h-32 mb-8">
        {/* Glow ring */}
        <div className="absolute inset-0 rounded-full bg-purple-500/10 animate-pulse" />
        <div className="absolute inset-3 rounded-full bg-purple-500/5" />
        {/* Rocket icon centered */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            <Rocket className="h-14 w-14 text-purple-400" />
            {/* Trail particles */}
            <motion.div
              className="absolute -bottom-3 left-1/2 -translate-x-1/2"
              animate={{ y: [0, 6, 0], opacity: [0.8, 0.3, 0.8] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Zap className="h-5 w-5 text-cyan-400" />
            </motion.div>
          </div>
        </div>
        {/* Orbiting dots */}
        <motion.div
          className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1"
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "50% 64px" }}
        >
          <div className="h-2 w-2 rounded-full bg-cyan-400" />
        </motion.div>
        <motion.div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1"
          animate={{ rotate: -360 }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "50% -64px" }}
        >
          <div className="h-1.5 w-1.5 rounded-full bg-pink-400" />
        </motion.div>
      </div>

      <h3 className="text-xl sm:text-2xl font-bold mb-2">
        No Missions Yet
      </h3>
      <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto mb-8 leading-relaxed">
        Launch your first AI-powered mission and watch autonomous agents plan,
        execute, and verify complex multi-step objectives.
      </p>
      <Button
        onClick={onCreateNew}
        className="btn-gradient text-white px-6 py-5 text-base"
      >
        <Plus className="mr-2 h-5 w-5" />
        Launch Your First Mission
      </Button>

      {/* Feature hints */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12 max-w-2xl mx-auto">
        {[
          { icon: Brain, label: "AI Planning", desc: "Intelligent task decomposition" },
          { icon: Play, label: "Auto Execution", desc: "Autonomous agent orchestration" },
          { icon: ShieldCheck, label: "Self-Verifying", desc: "Built-in quality assurance" },
        ].map((feat) => (
          <div
            key={feat.label}
            className="glass rounded-lg p-3 text-center space-y-1"
          >
            <feat.icon className="h-5 w-5 text-purple-400 mx-auto" />
            <p className="text-xs font-medium">{feat.label}</p>
            <p className="text-xs text-muted-foreground">{feat.desc}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
//  Mission Card
// ─────────────────────────────────────────────

function MissionCard({
  mission,
  index,
  onClick,
}: {
  mission: MissionListItem;
  index: number;
  onClick: () => void;
}) {
  const config = MISSION_STATUS_CONFIG[mission.status];
  const priorityColors: Record<string, string> = {
    LOW: "bg-emerald-500/20 text-emerald-400",
    NORMAL: "bg-slate-500/20 text-slate-300",
    HIGH: "bg-amber-500/20 text-amber-400",
    CRITICAL: "bg-red-500/20 text-red-400",
  };

  const progressColor =
    mission.status === "FAILED"
      ? "bg-red-500"
      : mission.status === "CANCELLED"
        ? "bg-gray-500"
        : mission.progress >= 80
          ? "bg-emerald-500"
          : mission.progress >= 40
            ? "bg-purple-500"
            : "bg-cyan-500";

  const isActive = ["EXECUTING", "PLANNING", "VERIFYING", "REPAIRING"].includes(
    mission.status,
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{
        duration: 0.35,
        delay: index * 0.06,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      layout
    >
      <Card
        className={"glass-strong border-purple-500/10 rounded-xl p-5 card-hover cursor-pointer group relative overflow-hidden"}
        onClick={onClick}
      >
        {/* Active glow effect */}
        {isActive && (
          <motion.div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
            style={{
              background:
                "radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(168,85,247,0.06), transparent 40%)",
            }}
          />
        )}

        {/* Header row: Title + Status */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="font-semibold text-sm sm:text-base leading-snug line-clamp-1 group-hover:text-purple-300 transition-colors">
            {mission.title}
          </h3>
          <Badge
            className={`${config.bgColor} ${config.color} border-0 shrink-0 text-[11px] font-medium gap-1`}
          >
            <StatusIcon status={mission.status} />
            {config.label}
          </Badge>
        </div>

        {/* Description */}
        <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
          {mission.description}
        </p>

        {/* Meta row: Priority + Date */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {mission.priority && (
            <Badge
              variant="outline"
              className={`${priorityColors[mission.priority] || priorityColors.NORMAL} border-0 text-[10px] px-1.5 py-0`}
            >
              <Target className="h-2.5 w-2.5 mr-1" />
              {mission.priority}
            </Badge>
          )}
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(mission.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium tabular-nums">{mission.progress}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${progressColor}`}
              initial={{ width: 0 }}
              animate={{ width: `${mission.progress}%` }}
              transition={{ duration: 1, delay: index * 0.06 + 0.2, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Task counts */}
        <div className="flex items-center gap-4 mt-3 text-[11px] text-muted-foreground">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-emerald-400" />
                <span className="tabular-nums">
                  {mission.completedTasks}/{mission.totalTasks}
                </span>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {mission.completedTasks} of {mission.totalTasks} tasks completed
            </TooltipContent>
          </Tooltip>

          {mission.failedTasks > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1 text-red-400">
                  <AlertTriangle className="h-3 w-3" />
                  <span className="tabular-nums">{mission.failedTasks} failed</span>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {mission.failedTasks} task{mission.failedTasks > 1 ? "s" : ""} failed
              </TooltipContent>
            </Tooltip>
          )}

          {mission.startedAt && (
            <span className="ml-auto text-muted-foreground/60">
              Started{" "}
              {new Date(mission.startedAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
        </div>

        {/* Budget bar */}
        <BudgetBar spent={mission.spentUsd} budget={mission.budgetUsd} />
      </Card>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
//  Main MissionsList Component
// ─────────────────────────────────────────────

export function MissionsList() {
  const { data: session } = useSession();
  const { navigate, setSelectedMission } = useApp();

  // Data state
  const [missions, setMissions] = useState<MissionListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // UI state
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [createOpen, setCreateOpen] = useState(false);

  // Fetch missions
  const fetchMissions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/missions");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setMissions(data.missions || []);
      setTotal(data.total || 0);
    } catch {
      setMissions([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMissions();
  }, [fetchMissions]);

  // Computed stats
  const activeCount = missions.filter((m) =>
    ["EXECUTING", "PLANNING", "VERIFYING", "REPAIRING"].includes(m.status),
  ).length;
  const completedCount = missions.filter((m) => m.status === "COMPLETED").length;
  const failedCount = missions.filter((m) =>
    ["FAILED", "CANCELLED"].includes(m.status),
  ).length;

  const animTotal = useAnimatedCounter(total);
  const animActive = useAnimatedCounter(activeCount);
  const animCompleted = useAnimatedCounter(completedCount);
  const animFailed = useAnimatedCounter(failedCount);

  // Filter missions
  const filterDef = FILTERS.find((f) => f.key === activeFilter);
  const filtered = missions.filter((m) => {
    const matchesFilter =
      !filterDef || filterDef.statuses.length === 0 || filterDef.statuses.includes(m.status);
    const matchesSearch =
      !search ||
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      m.description.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleCardClick = (mission: MissionListItem) => {
    setSelectedMission(mission.id);
    navigate("missionDetail", { id: mission.id });
  };

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-purple-500/10 glow-sm">
              <Rocket className="h-5 w-5 text-purple-400" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold">
              <span className="gradient-text">Mission Command Center</span>
            </h1>
          </div>
          <p className="text-sm text-muted-foreground ml-[52px]">
            Autonomous AI Execution Platform
          </p>
        </div>

        <Button
          onClick={() => setCreateOpen(true)}
          className="btn-gradient text-white shrink-0"
          size="lg"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Mission
        </Button>
      </motion.div>

      {/* ── Stats Bar ──────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
      >
        {[
          {
            label: "Total Missions",
            value: animTotal,
            icon: Target,
            color: "text-purple-400",
            bg: "bg-purple-500/10",
            border: "border-purple-500/20",
          },
          {
            label: "Active",
            value: animActive,
            icon: Zap,
            color: "text-cyan-400",
            bg: "bg-cyan-500/10",
            border: "border-cyan-500/20",
          },
          {
            label: "Completed",
            value: animCompleted,
            icon: CheckCircle,
            color: "text-emerald-400",
            bg: "bg-emerald-500/10",
            border: "border-emerald-500/20",
          },
          {
            label: "Failed",
            value: animFailed,
            icon: AlertTriangle,
            color: "text-red-400",
            bg: "bg-red-500/10",
            border: "border-red-500/20",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`glass-strong rounded-xl p-4 border ${stat.border}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                {stat.label}
              </span>
              <div className={`p-1.5 rounded-md ${stat.bg}`}>
                <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
              </div>
            </div>
            <span className={`text-2xl sm:text-3xl font-bold tabular-nums ${stat.color}`}>
              {stat.value}
            </span>
          </div>
        ))}
      </motion.div>

      {/* ── Filter Bar ─────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="flex flex-col sm:flex-row gap-3"
      >
        {/* Filter pills */}
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map((f) => (
            <Button
              key={f.key}
              variant={activeFilter === f.key ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveFilter(f.key)}
              className={
                activeFilter === f.key
                  ? "btn-gradient text-white border-0"
                  : "glass text-muted-foreground hover:text-foreground"
              }
            >
              <Filter className="h-3 w-3 mr-1.5" />
              {f.label}
            </Button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative flex-1 min-w-0 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search missions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 glass bg-white/5"
          />
        </div>
      </motion.div>

      {/* ── Mission List ───────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <MissionCardSkeleton key={i} />
          ))}
        </div>
      ) : !loading && missions.length === 0 ? (
        <EmptyState onCreateNew={() => setCreateOpen(true)} />
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-strong border-purple-500/10 rounded-xl p-12 text-center"
        >
          <Search className="h-10 w-10 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-1">No matching missions</h3>
          <p className="text-sm text-muted-foreground">
            Try adjusting your search or filter criteria.
          </p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((mission, i) => (
              <MissionCard
                key={mission.id}
                mission={mission}
                index={i}
                onClick={() => handleCardClick(mission)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── Create Mission Dialog ──────────── */}
      <CreateMissionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={fetchMissions}
      />
    </div>
  );
}
