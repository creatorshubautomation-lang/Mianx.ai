"use client";

import { useState, useEffect, useCallback } from "react";
import { useApp } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  Loader2,
  RefreshCw,
  Filter,
  Bell,
  ArrowLeft,
  Zap,
  Timer,
  DollarSign,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

interface ApprovalRecord {
  id: string;
  missionId: string;
  taskId: string | null;
  status: string;
  title: string;
  description: string | null;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  approvalType: string;
  metadata: Record<string, unknown> | null;
  responseNote: string | null;
  respondedAt: string | null;
  createdAt: string;
  timeSinceCreated?: string;
  missionTitle?: string;
}

interface ApprovalStats {
  pendingCount: number;
  approvedToday: number;
  rejectedToday: number;
  byRiskLevel: Record<string, number>;
  oldestPending?: ApprovalRecord;
  averageResponseTimeMs?: number;
}

// ─────────────────────────────────────────────
//  Config
// ─────────────────────────────────────────────

const RISK_CONFIG: Record<string, { color: string; bg: string; border: string; label: string; icon: typeof Shield }> = {
  LOW: { color: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/30", label: "Low Risk", icon: Shield },
  MEDIUM: { color: "text-amber-400", bg: "bg-amber-500/15", border: "border-amber-500/30", label: "Medium Risk", icon: ShieldAlert },
  HIGH: { color: "text-orange-400", bg: "bg-orange-500/15", border: "border-orange-500/30", label: "High Risk", icon: ShieldAlert },
  CRITICAL: { color: "text-red-400", bg: "bg-red-500/15", border: "border-red-500/30", label: "Critical Risk", icon: ShieldX },
};

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
];

const RISK_FILTERS = [
  { key: "all", label: "All Risk" },
  { key: "CRITICAL", label: "Critical" },
  { key: "HIGH", label: "High" },
  { key: "MEDIUM", label: "Medium" },
  { key: "LOW", label: "Low" },
];

// ─────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────

export function ApprovalQueue() {
  const { navigate, setSelectedMission } = useApp();
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([]);
  const [stats, setStats] = useState<ApprovalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);

  // Fetch approvals
  const fetchApprovals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (riskFilter !== "all") params.set("riskLevel", riskFilter);
      params.set("limit", "100");

      const res = await fetch(`/api/approvals?${params}`);
      if (!res.ok) throw new Error("Failed to fetch approvals");
      const data = await res.json();
      setApprovals(data.approvals || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, riskFilter]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/approvals/stats");
      if (!res.ok) return;
      const data = await res.json();
      setStats(data.stats);
    } catch {
      // ignore stats errors
    }
  }, []);

  useEffect(() => {
    fetchApprovals();
    fetchStats();
  }, [fetchApprovals, fetchStats]);

  // Auto-refresh every 15 seconds for pending approvals
  useEffect(() => {
    const interval = setInterval(() => {
      if (statusFilter === "all" || statusFilter === "PENDING") {
        fetchApprovals();
        fetchStats();
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchApprovals, fetchStats, statusFilter]);

  // Process approval (approve/reject)
  const handleAction = async (approvalId: string, action: "approve" | "reject", note?: string) => {
    setProcessing(approvalId);
    try {
      const res = await fetch(`/api/approvals/${approvalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      });
      const data = await res.json();

      if (data.success) {
        // Remove from list or update status
        setApprovals((prev) =>
          prev.map((a) =>
            a.id === approvalId ? { ...a, status: data.newStatus as string, responseNote: note ?? null } : a
          )
        );
        // Refresh stats
        fetchStats();
      } else {
        setError(data.error || "Action failed");
      }
    } catch {
      setError("Failed to process approval");
    } finally {
      setProcessing(null);
      setActiveNote(null);
      setNoteText("");
    }
  };

  // Navigate to mission
  const goToMission = (missionId: string) => {
    setSelectedMission(missionId);
    navigate("missionDetail", { id: missionId });
  };

  const filteredApprovals = approvals.filter((a) => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (riskFilter !== "all" && a.riskLevel !== riskFilter) return false;
    return true;
  });

  // ── Render ──

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500">
              <Shield className="h-5 w-5 text-white" />
            </div>
            Approval Queue
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review and approve actions that require human oversight
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              fetchApprovals();
              fetchStats();
            }}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          {stats && stats.pendingCount > 0 && (
            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 px-3 py-1">
              {stats.pendingCount} pending
            </Badge>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatsCard
            icon={Bell}
            label="Pending"
            value={stats.pendingCount}
            color="text-amber-400"
            bg="bg-amber-500/10"
            accent="from-amber-500/20"
          />
          <StatsCard
            icon={CheckCircle2}
            label="Approved Today"
            value={stats.approvedToday}
            color="text-emerald-400"
            bg="bg-emerald-500/10"
            accent="from-emerald-500/20"
          />
          <StatsCard
            icon={XCircle}
            label="Rejected Today"
            value={stats.rejectedToday}
            color="text-red-400"
            bg="bg-red-500/10"
            accent="from-red-500/20"
          />
          <StatsCard
            icon={Timer}
            label="Avg Response"
            value={stats.averageResponseTimeMs ? formatDuration(stats.averageResponseTimeMs) : "N/A"}
            color="text-blue-400"
            bg="bg-blue-500/10"
            accent="from-blue-500/20"
          />
        </div>
      )}

      {/* Risk Level Breakdown */}
      {stats && stats.pendingCount > 0 && (
        <div className="rounded-xl glass border border-purple-500/10 p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Pending by Risk Level
          </h3>
          <div className="flex items-center gap-3 flex-wrap">
            {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((level) => {
              const count = stats.byRiskLevel[level] || 0;
              if (count === 0) return null;
              const cfg = RISK_CONFIG[level];
              return (
                <div
                  key={level}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${cfg.bg} border ${cfg.border}`}
                >
                  <cfg.icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                  <span className={`text-sm font-medium ${cfg.color}`}>
                    {count}
                  </span>
                  <span className="text-xs text-muted-foreground">{cfg.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {STATUS_FILTERS.map((f) => (
          <Button
            key={f.key}
            variant={statusFilter === f.key ? "default" : "ghost"}
            size="sm"
            onClick={() => setStatusFilter(f.key)}
            className={
              statusFilter === f.key
                ? "bg-purple-500/20 text-purple-300 hover:bg-purple-500/30"
                : "text-muted-foreground"
            }
          >
            {f.label}
          </Button>
        ))}
        <span className="w-px h-6 bg-border mx-1" />
        {RISK_FILTERS.map((f) => (
          <Button
            key={f.key}
            variant={riskFilter === f.key ? "default" : "ghost"}
            size="sm"
            onClick={() => setRiskFilter(f.key)}
            className={
              riskFilter === f.key
                ? "bg-purple-500/20 text-purple-300 hover:bg-purple-500/30"
                : "text-muted-foreground"
            }
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 flex items-center gap-2 text-red-400 text-sm">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {error}
          <Button variant="ghost" size="sm" className="ml-auto text-red-400" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Loading */}
      {loading && approvals.length === 0 && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-purple-400 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Loading approvals...</p>
          </div>
        </div>
      )}

      {/* Empty */}
      {!loading && filteredApprovals.length === 0 && (
        <div className="flex items-center justify-center py-20 rounded-xl glass border border-purple-500/10">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15">
              <ShieldCheck className="h-8 w-8 text-emerald-400" />
            </div>
            <h3 className="text-lg font-semibold mb-1">All Clear</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              {statusFilter === "all"
                ? "No approvals in the queue. The system is running autonomously."
                : `No ${statusFilter.toLowerCase()} approvals found.`}
            </p>
          </div>
        </div>
      )}

      {/* Approval Cards */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {filteredApprovals.map((approval) => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
              processing={processing === approval.id}
              showNote={activeNote === approval.id}
              noteText={noteText}
              onNoteChange={setNoteText}
              onApprove={(note) => handleAction(approval.id, "approve", note)}
              onReject={(note) => handleAction(approval.id, "reject", note)}
              onToggleNote={() => setActiveNote(activeNote === approval.id ? null : approval.id)}
              onGoToMission={() => goToMission(approval.missionId)}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Approval Card
// ─────────────────────────────────────────────

function ApprovalCard({
  approval,
  processing,
  showNote,
  noteText,
  onNoteChange,
  onApprove,
  onReject,
  onToggleNote,
  onGoToMission,
}: {
  approval: ApprovalRecord;
  processing: boolean;
  showNote: boolean;
  noteText: string;
  onNoteChange: (v: string) => void;
  onApprove: (note?: string) => void;
  onReject: (note?: string) => void;
  onToggleNote: () => void;
  onGoToMission: () => void;
}) {
  const riskCfg = RISK_CONFIG[approval.riskLevel] || RISK_CONFIG.MEDIUM;
  const isResolved = approval.status === "APPROVED" || approval.status === "REJECTED";
  const RiskIcon = riskCfg.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className={`rounded-xl glass border p-4 transition-colors ${
        approval.status === "APPROVED"
          ? "border-emerald-500/20"
          : approval.status === "REJECTED"
            ? "border-red-500/20"
            : `${riskCfg.border} hover:${riskCfg.border.replace("/30", "/50")}`
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Risk Icon */}
        <div className={`flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-lg ${riskCfg.bg} mt-0.5`}>
          {isResolved ? (
            approval.status === "APPROVED" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            ) : (
              <XCircle className="h-5 w-5 text-red-400" />
            )
          ) : (
            <RiskIcon className={`h-5 w-5 ${riskCfg.color}`} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm">{approval.title}</h3>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${riskCfg.bg} ${riskCfg.color}`}>
              <RiskIcon className="h-3 w-3" />
              {riskCfg.label}
            </span>
            {approval.status === "APPROVED" && (
              <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10 text-[10px]">
                Approved
              </Badge>
            )}
            {approval.status === "REJECTED" && (
              <Badge variant="outline" className="text-red-400 border-red-500/30 bg-red-500/10 text-[10px]">
                Rejected
              </Badge>
            )}
          </div>

          {approval.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {approval.description}
            </p>
          )}

          {/* Metadata */}
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {approval.timeSinceCreated || formatTimeAgo(approval.createdAt)}
            </span>
            {approval.missionTitle && (
              <button
                onClick={onGoToMission}
                className="flex items-center gap-1 hover:text-purple-400 transition-colors"
              >
                <Zap className="h-3 w-3" />
                {approval.missionTitle}
                <ChevronRight className="h-3 w-3" />
              </button>
            )}
            {approval.approvalType && approval.approvalType !== "custom" && (
              <span className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                {approval.approvalType.replace(/_/g, " ")}
              </span>
            )}
            {approval.responseNote && (
              <span className="text-muted-foreground italic">
                Note: &quot;{approval.responseNote}&quot;
              </span>
            )}
          </div>

          {/* Note input */}
          <AnimatePresence>
            {showNote && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3"
              >
                <Textarea
                  placeholder="Add an optional note (reason for approval/rejection)..."
                  value={noteText}
                  onChange={(e) => onNoteChange(e.target.value)}
                  className="min-h-[60px] bg-purple-500/5 border-purple-500/20 text-sm"
                  autoFocus
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Buttons */}
          {!isResolved && (
            <div className="flex items-center gap-2 mt-3">
              <Button
                size="sm"
                onClick={() => {
                  onToggleNote();
                  setTimeout(() => onApprove(showNote ? noteText : undefined), showNote ? 0 : 0);
                  if (!showNote) onApprove();
                }}
                disabled={processing}
                className="bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border-0 text-xs"
              >
                {processing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                )}
                Approve
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  onToggleNote();
                  if (!showNote) onReject();
                }}
                disabled={processing}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs"
              >
                <XCircle className="h-3.5 w-3.5 mr-1" />
                Reject
              </Button>
              {!showNote && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onToggleNote}
                  className="text-muted-foreground text-xs"
                >
                  Add note
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
//  Stats Card
// ─────────────────────────────────────────────

function StatsCard({
  icon: Icon,
  label,
  value,
  color,
  bg,
  accent,
}: {
  icon: typeof Shield;
  label: string;
  value: number | string;
  color: string;
  bg: string;
  accent: string;
}) {
  return (
    <div className={`rounded-xl glass border border-purple-500/10 p-3 bg-gradient-to-br ${accent} to-transparent`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}
