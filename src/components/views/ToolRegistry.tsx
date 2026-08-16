"use client";

// Mianx.ai — Phase 4: Tool Registry UI
//
// Dashboard view showing all registered tools with:
//   - Stats bar (total, by risk, by category)
//   - Category filter pills
//   - Risk level filter
//   - Search bar
//   - Tool cards with full details

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wrench,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  FileText,
  Code2,
  GitBranch,
  Database,
  Globe,
  Rocket,
  Brain,
  Settings,
  Filter,
  ChevronDown,
  ExternalLink,
  Zap,
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

interface ToolDef {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: ToolCategory;
  riskLevel: RiskLevel;
  inputSchema: string;
  outputSchema: string | null;
  handler: string;
  timeoutMs: number;
  retryable: boolean;
  maxRetries: number;
  requireApproval: boolean;
  allowedAgents: string[];
  allowedPlans: string[];
  costPerCall: number;
  enabled: boolean;
  categoryConfig?: {
    label: string;
    icon: string;
    color: string;
    bgColor: string;
    description: string;
  };
}

type ToolCategory = "FILE" | "CODE" | "GIT" | "DATABASE" | "WEB" | "DEPLOY" | "AI" | "SYSTEM";
type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

interface ToolStats {
  totalTools: number;
  enabledTools: number;
  byCategory: Record<ToolCategory, number>;
  byRiskLevel: Record<RiskLevel, number>;
  highRiskCount: number;
  approvalRequiredCount: number;
}

// ─────────────────────────────────────────────
//  Config maps
// ─────────────────────────────────────────────

const CATEGORY_ICONS: Record<ToolCategory, React.ReactNode> = {
  FILE: <FileText className="w-4 h-4" />,
  CODE: <Code2 className="w-4 h-4" />,
  GIT: <GitBranch className="w-4 h-4" />,
  DATABASE: <Database className="w-4 h-4" />,
  WEB: <Globe className="w-4 h-4" />,
  DEPLOY: <Rocket className="w-4 h-4" />,
  AI: <Brain className="w-4 h-4" />,
  SYSTEM: <Settings className="w-4 h-4" />,
};

const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; bgColor: string; icon: React.ReactNode; borderColor: string }> = {
  LOW: { label: "Low", color: "text-green-400", bgColor: "bg-green-500/20", icon: <ShieldCheck className="w-3.5 h-3.5" />, borderColor: "border-green-500/30" },
  MEDIUM: { label: "Medium", color: "text-amber-400", bgColor: "bg-amber-500/20", icon: <Shield className="w-3.5 h-3.5" />, borderColor: "border-amber-500/30" },
  HIGH: { label: "High", color: "text-orange-400", bgColor: "bg-orange-500/20", icon: <ShieldAlert className="w-3.5 h-3.5" />, borderColor: "border-orange-500/30" },
  CRITICAL: { label: "Critical", color: "text-red-400", bgColor: "bg-red-500/20", icon: <AlertTriangle className="w-3.5 h-3.5" />, borderColor: "border-red-500/30" },
};

const CATEGORY_COLORS: Record<ToolCategory, { color: string; bgColor: string; borderColor: string }> = {
  FILE: { color: "text-blue-400", bgColor: "bg-blue-500/20", borderColor: "border-blue-500/30" },
  CODE: { color: "text-violet-400", bgColor: "bg-violet-500/20", borderColor: "border-violet-500/30" },
  GIT: { color: "text-orange-400", bgColor: "bg-orange-500/20", borderColor: "border-orange-500/30" },
  DATABASE: { color: "text-emerald-400", bgColor: "bg-emerald-500/20", borderColor: "border-emerald-500/30" },
  WEB: { color: "text-cyan-400", bgColor: "bg-cyan-500/20", borderColor: "border-cyan-500/30" },
  DEPLOY: { color: "text-pink-400", bgColor: "bg-pink-500/20", borderColor: "border-pink-500/30" },
  AI: { color: "text-purple-400", bgColor: "bg-purple-500/20", borderColor: "border-purple-500/30" },
  SYSTEM: { color: "text-gray-400", bgColor: "bg-gray-500/20", borderColor: "border-gray-500/30" },
};

// ─────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────

export function ToolRegistry() {
  const [tools, setTools] = useState<ToolDef[]>([]);
  const [stats, setStats] = useState<ToolStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ToolCategory | "ALL">("ALL");
  const [riskFilter, setRiskFilter] = useState<RiskLevel | "ALL">("ALL");
  const [selectedTool, setSelectedTool] = useState<ToolDef | null>(null);

  // Fetch tools
  const fetchTools = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter !== "ALL") params.set("category", categoryFilter);
      if (riskFilter !== "ALL") params.set("riskLevel", riskFilter);
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/tools?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTools(data.tools || []);
      }
    } catch (err) {
      console.error("Failed to fetch tools:", err);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, riskFilter, searchQuery]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/tools?action=stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
      }
    } catch (err) {
      console.error("Failed to fetch tool stats:", err);
    }
  }, []);

  useEffect(() => {
    fetchTools();
    fetchStats();
  }, [fetchTools, fetchStats]);

  // Filtered tools (client-side search refinement)
  const filteredTools = tools.filter((tool) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        tool.name.toLowerCase().includes(q) ||
        tool.displayName.toLowerCase().includes(q) ||
        tool.description.toLowerCase().includes(q) ||
        tool.handler.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-purple-500/20">
              <Wrench className="h-5 w-5 text-white" />
            </div>
            Tool Registry
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Secure, permissioned tools for agent execution
          </p>
        </div>
        <button
          onClick={() => { fetchTools(); fetchStats(); }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Total Tools"
            value={stats.totalTools}
            icon={<Wrench className="w-4 h-4" />}
            color="text-violet-400"
            bgColor="bg-violet-500/20"
          />
          <StatCard
            label="Enabled"
            value={stats.enabledTools}
            icon={<CheckCircle2 className="w-4 h-4" />}
            color="text-emerald-400"
            bgColor="bg-emerald-500/20"
          />
          <StatCard
            label="High Risk"
            value={stats.highRiskCount}
            icon={<ShieldAlert className="w-4 h-4" />}
            color="text-orange-400"
            bgColor="bg-orange-500/20"
          />
          <StatCard
            label="Need Approval"
            value={stats.approvalRequiredCount}
            icon={<AlertTriangle className="w-4 h-4" />}
            color="text-amber-400"
            bgColor="bg-amber-500/20"
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tools by name, handler, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-white/10 bg-white/5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50"
          />
        </div>

        {/* Category Filter */}
        <div className="relative">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as ToolCategory | "ALL")}
            className="appearance-none pl-3 pr-8 py-2.5 rounded-lg border border-white/10 bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 cursor-pointer"
          >
            <option value="ALL">All Categories</option>
            {Object.entries(CATEGORY_COLORS).map(([key, config]) => (
              <option key={key} value={key}>{key}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>

        {/* Risk Filter */}
        <div className="relative">
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value as RiskLevel | "ALL")}
            className="appearance-none pl-3 pr-8 py-2.5 rounded-lg border border-white/10 bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 cursor-pointer"
          >
            <option value="ALL">All Risk Levels</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Category pills row */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setCategoryFilter("ALL")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            categoryFilter === "ALL"
              ? "bg-violet-500/30 text-violet-300 border border-violet-500/50"
              : "bg-white/5 text-muted-foreground border border-white/10 hover:bg-white/10"
          }`}
        >
          All ({stats?.totalTools ?? 0})
        </button>
        {(Object.entries(CATEGORY_COLORS) as [ToolCategory, typeof CATEGORY_COLORS[ToolCategory]][]).map(([cat, config]) => {
          const count = stats?.byCategory[cat] || 0;
          if (count === 0) return null;
          return (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                categoryFilter === cat
                  ? `${config.bgColor} ${config.color} border ${config.borderColor}`
                  : "bg-white/5 text-muted-foreground border border-white/10 hover:bg-white/10"
              }`}
            >
              {CATEGORY_ICONS[cat]}
              {cat} ({count})
            </button>
          );
        })}
      </div>

      {/* Tool Cards Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
          <span className="ml-3 text-muted-foreground">Loading tools...</span>
        </div>
      ) : filteredTools.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Wrench className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">No tools found</h3>
          <p className="text-sm text-muted-foreground/70 mt-1">
            {searchQuery || categoryFilter !== "ALL" || riskFilter !== "ALL"
              ? "Try adjusting your filters"
              : "No tools have been registered yet"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredTools.map((tool) => (
              <ToolCard
                key={tool.id}
                tool={tool}
                isSelected={selectedTool?.id === tool.id}
                onClick={() => setSelectedTool(selectedTool?.id === tool.id ? null : tool)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Selected Tool Detail Panel */}
      <AnimatePresence>
        {selectedTool && (
          <ToolDetailPanel tool={selectedTool} onClose={() => setSelectedTool(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Sub-components
// ─────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  color,
  bgColor,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${bgColor}`}>
          <span className={color}>{icon}</span>
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  );
}

function ToolCard({
  tool,
  isSelected,
  onClick,
}: {
  tool: ToolDef;
  isSelected: boolean;
  onClick: () => void;
}) {
  const catConfig = CATEGORY_COLORS[tool.category];
  const riskConfig = RISK_CONFIG[tool.riskLevel];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className={`group relative rounded-xl border bg-white/[0.03] backdrop-blur-sm overflow-hidden cursor-pointer transition-all hover:shadow-lg ${
        isSelected
          ? `border-violet-500/50 ring-1 ring-violet-500/30 shadow-violet-500/10`
          : "border-white/10 hover:border-white/20"
      }`}
    >
      {/* Top accent line */}
      <div className={`h-0.5 ${catConfig.bgColor}`} />

      <div className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${catConfig.bgColor} ${catConfig.color}`}>
              {CATEGORY_ICONS[tool.category]}
            </div>
            <div>
              <h3 className="font-semibold text-sm leading-tight">{tool.displayName}</h3>
              <p className="text-xs text-muted-foreground font-mono">{tool.name}</p>
            </div>
          </div>
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${riskConfig.bgColor} ${riskConfig.color}`}>
            {riskConfig.icon}
            {riskConfig.label}
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {tool.description}
        </p>

        {/* Tags row */}
        <div className="flex flex-wrap gap-1.5">
          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${catConfig.bgColor} ${catConfig.color}`}>
            {tool.category}
          </span>
          {tool.requireApproval && (
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-400">
              Approval Required
            </span>
          )}
          {tool.retryable && (
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-cyan-500/20 text-cyan-400">
              Retryable
            </span>
          )}
          {tool.costPerCall > 0 && (
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-green-500/20 text-green-400 flex items-center gap-0.5">
              <DollarSign className="w-2.5 h-2.5" />
              {tool.costPerCall.toFixed(3)}/call
            </span>
          )}
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {(tool.timeoutMs / 1000).toFixed(0)}s
          </span>
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3" />
            {tool.handler}
          </span>
          <span className="flex items-center gap-1">
            {tool.enabled ? (
              <><CheckCircle2 className="w-3 h-3 text-green-400" /> Enabled</>
            ) : (
              <><XCircle className="w-3 h-3 text-red-400" /> Disabled</>
            )}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function ToolDetailPanel({
  tool,
  onClose,
}: {
  tool: ToolDef;
  onClose: () => void;
}) {
  const catConfig = CATEGORY_COLORS[tool.category];
  const riskConfig = RISK_CONFIG[tool.riskLevel];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="rounded-xl border border-violet-500/30 bg-white/[0.03] backdrop-blur-sm overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${catConfig.bgColor} ${catConfig.color}`}>
            {CATEGORY_ICONS[tool.category]}
          </div>
          <div>
            <h2 className="font-bold">{tool.displayName}</h2>
            <p className="text-xs text-muted-foreground font-mono">{tool.name} / {tool.handler}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
        >
          <XCircle className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left column: Description + Schema */}
        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Description</h3>
            <p className="text-sm leading-relaxed">{tool.description}</p>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Input Schema</h3>
            <pre className="text-xs bg-black/30 rounded-lg p-3 overflow-auto max-h-40 font-mono text-muted-foreground">
              {(() => {
                try {
                  return JSON.stringify(JSON.parse(tool.inputSchema), null, 2);
                } catch {
                  return tool.inputSchema;
                }
              })()}
            </pre>
          </div>
        </div>

        {/* Right column: Properties */}
        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Properties</h3>
            <div className="space-y-2">
              <PropertyRow label="Category" value={tool.category} color={catConfig.color} />
              <PropertyRow label="Risk Level" value={`${tool.riskLevel} — ${riskConfig.label}`} color={riskConfig.color} />
              <PropertyRow label="Timeout" value={`${tool.timeoutMs}ms (${(tool.timeoutMs / 1000).toFixed(1)}s)`} />
              <PropertyRow label="Retryable" value={`${tool.retryable} (max ${tool.maxRetries} retries)`} />
              <PropertyRow label="Require Approval" value={tool.requireApproval ? "Yes" : "No"} />
              <PropertyRow label="Cost per Call" value={`$${tool.costPerCall.toFixed(4)}`} />
              <PropertyRow label="Enabled" value={tool.enabled ? "Yes" : "No"} />
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Allowed Agents ({tool.allowedAgents.length})
            </h3>
            {tool.allowedAgents.length === 0 ? (
              <p className="text-xs text-muted-foreground">All agents allowed</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {tool.allowedAgents.map((agent) => (
                  <span key={agent} className="px-2 py-0.5 rounded text-xs bg-white/10 text-muted-foreground">
                    {agent}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Allowed Plans ({tool.allowedPlans.length})
            </h3>
            {tool.allowedPlans.length === 0 ? (
              <p className="text-xs text-muted-foreground">All plans allowed</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {tool.allowedPlans.map((plan) => (
                  <span key={plan} className="px-2 py-0.5 rounded text-xs bg-white/10 text-muted-foreground">
                    {plan}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function PropertyRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-xs font-medium ${color || "text-foreground"}`}>{value}</span>
    </div>
  );
}
