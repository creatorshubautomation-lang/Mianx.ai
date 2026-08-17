"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useApp } from "@/lib/store";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ShieldCheck,
  Shield,
  Lock,
  Fingerprint,
  Clock,
  Globe,
  HardDrive,
  Users,
  UserCog,
  FileText,
  Save,
  Loader2,
  Check,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  Eye,
  KeyRound,
  Bot,
  Database,
  Timer,
  ChevronRight,
  CircleDot,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ──────────────────────────────────────────────
//  Types
// ──────────────────────────────────────────────

interface OrgSetting {
  id: string;
  key: string;
  value: string;
  scope: string;
}

interface AuditLog {
  id: string;
  action: string;
  actorType: string;
  actorName: string;
  resource: string;
  details: string;
  createdAt: string;
}

interface OrgRole {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  permissionsCount: number;
}

interface OrgMember {
  id: string;
  user: { name: string; email: string };
  role: string;
  status: string;
  joinedAt: string;
}

type CheckStatus = "enabled" | "not_configured" | "disabled";

interface SecurityCheck {
  id: string;
  label: string;
  description: string;
  status: CheckStatus;
  icon: React.ElementType;
}

// ──────────────────────────────────────────────
//  Constants
// ──────────────────────────────────────────────

const SESSION_TIMEOUT_OPTIONS = [
  { value: "15", label: "15 minutes" },
  { value: "30", label: "30 minutes" },
  { value: "60", label: "60 minutes" },
  { value: "120", label: "120 minutes" },
];

const AUTONOMY_LEVELS = [
  { value: "L0", label: "L0 — No Autonomy" },
  { value: "L1", label: "L1 — Assisted" },
  { value: "L2", label: "L2 — Supervised" },
  { value: "L3", label: "L3 — Guided" },
  { value: "L4", label: "L4 — Semi-Autonomous" },
  { value: "L5", label: "L5 — Fully Autonomous" },
];

const RETENTION_OPTIONS = [
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" },
  { value: "180", label: "180 days" },
  { value: "365", label: "365 days" },
];

const AUDIT_RETENTION_OPTIONS = [
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" },
  { value: "180", label: "180 days" },
  { value: "365", label: "1 year" },
  { value: "730", label: "2 years" },
];

const STATUS_BADGE_STYLES: Record<string, string> = {
  enabled: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  not_configured: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  disabled: "bg-red-500/20 text-red-300 border-red-500/30",
};

const STATUS_LABELS: Record<CheckStatus, string> = {
  enabled: "Enabled",
  not_configured: "Not Configured",
  disabled: "Disabled",
};

const MEMBER_STATUS_STYLES: Record<string, string> = {
  Active: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  Invited: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  Pending: "bg-amber-500/20 text-amber-300 border-amber-500/30",
};

const ACTION_STYLES: Record<string, string> = {
  create: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  update: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  delete: "bg-red-500/20 text-red-300 border-red-500/30",
  login: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  invite: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  remove: "bg-orange-500/20 text-orange-300 border-orange-500/30",
};

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

// ──────────────────────────────────────────────
//  Helper
// ──────────────────────────────────────────────

function getSettingValue(
  settings: OrgSetting[],
  key: string,
): string | undefined {
  return settings.find((s) => s.key === key)?.value;
}

function formatTimestamp(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ──────────────────────────────────────────────
//  Component
// ──────────────────────────────────────────────

export function SecuritySettingsView() {
  const { activeOrgId, navigate } = useApp();

  // ── Data state ──
  const [settings, setSettings] = useState<OrgSetting[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [roles, setRoles] = useState<OrgRole[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);

  // ── UI state ──
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // ── Policy form state ──
  const [sessionTimeout, setSessionTimeout] = useState("30");
  const [maxConcurrent, setMaxConcurrent] = useState("3");
  const [maxAutonomy, setMaxAutonomy] = useState("L3");
  const [requireApproval, setRequireApproval] = useState(true);
  const [allowDelegation, setAllowDelegation] = useState(false);
  const [dataRetention, setDataRetention] = useState("90");
  const [allowExport, setAllowExport] = useState(true);
  const [auditRetention, setAuditRetention] = useState("180");

  // ── Audit filter ──
  const [actionFilter, setActionFilter] = useState<string>("all");

  // ── Fetch all data ──
  const fetchData = useCallback(async () => {
    if (!activeOrgId) return;
    setLoading(true);
    setError(null);

    try {
      const [settingsRes, auditRes, rolesRes, membersRes] = await Promise.all([
        fetch(`/api/organizations/${activeOrgId}/settings`),
        fetch(`/api/organizations/${activeOrgId}/audit`),
        fetch(`/api/organizations/${activeOrgId}/roles`),
        fetch(`/api/organizations/${activeOrgId}/members`),
      ]);

      if (!settingsRes.ok) throw new Error("Failed to fetch settings");
      if (!auditRes.ok) throw new Error("Failed to fetch audit logs");
      if (!rolesRes.ok) throw new Error("Failed to fetch roles");
      if (!membersRes.ok) throw new Error("Failed to fetch members");

      const settingsData = await settingsRes.json();
      const auditData = await auditRes.json();
      const rolesData = await rolesRes.json();
      const membersData = await membersRes.json();

      const s: OrgSetting[] = settingsData.settings || [];
      setSettings(s);
      setSessionTimeout(getSettingValue(s, "security.session.timeout") || "30");
      setMaxConcurrent(getSettingValue(s, "security.session.maxConcurrent") || "3");
      setMaxAutonomy(getSettingValue(s, "security.agent.maxAutonomy") || "L3");
      setRequireApproval(getSettingValue(s, "security.agent.requireApproval") !== "false");
      setAllowDelegation(getSettingValue(s, "security.agent.allowDelegation") === "true");
      setDataRetention(getSettingValue(s, "security.data.retention") || "90");
      setAllowExport(getSettingValue(s, "security.data.allowExport") !== "false");
      setAuditRetention(getSettingValue(s, "security.audit.retention") || "180");
      setAuditLogs(auditData.logs || []);
      setRoles(rolesData.roles || []);
      setMembers(membersData.members || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load security data");
    } finally {
      setLoading(false);
    }
  }, [activeOrgId]);

  useEffect(() => {
    if (!activeOrgId) return;
    const controller = new AbortController();

    Promise.all([
      fetch(`/api/organizations/${activeOrgId}/settings`, { signal: controller.signal }),
      fetch(`/api/organizations/${activeOrgId}/audit`, { signal: controller.signal }),
      fetch(`/api/organizations/${activeOrgId}/roles`, { signal: controller.signal }),
      fetch(`/api/organizations/${activeOrgId}/members`, { signal: controller.signal }),
    ])
      .then(([settingsRes, auditRes, rolesRes, membersRes]) => {
        if (!settingsRes.ok) throw new Error("Failed to fetch settings");
        if (!auditRes.ok) throw new Error("Failed to fetch audit logs");
        if (!rolesRes.ok) throw new Error("Failed to fetch roles");
        if (!membersRes.ok) throw new Error("Failed to fetch members");
        return Promise.all([settingsRes.json(), auditRes.json(), rolesRes.json(), membersRes.json()]);
      })
      .then(([settingsData, auditData, rolesData, membersData]) => {
        const s: OrgSetting[] = settingsData.settings || [];
        setSettings(s);
        setSessionTimeout(getSettingValue(s, "security.session.timeout") || "30");
        setMaxConcurrent(getSettingValue(s, "security.session.maxConcurrent") || "3");
        setMaxAutonomy(getSettingValue(s, "security.agent.maxAutonomy") || "L3");
        setRequireApproval(getSettingValue(s, "security.agent.requireApproval") !== "false");
        setAllowDelegation(getSettingValue(s, "security.agent.allowDelegation") === "true");
        setDataRetention(getSettingValue(s, "security.data.retention") || "90");
        setAllowExport(getSettingValue(s, "security.data.allowExport") !== "false");
        setAuditRetention(getSettingValue(s, "security.audit.retention") || "180");
        setAuditLogs(auditData.logs || []);
        setRoles(rolesData.roles || []);
        setMembers(membersData.members || []);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err instanceof Error ? err.message : "Failed to load security data");
        }
      })
      .finally(() => {
        setLoading(false);
      });

    return () => { controller.abort(); };
  }, [activeOrgId]);

  // ── Save policies ──
  const savePolicies = useCallback(
    async (section: string, keyValuePairs: { key: string; value: string }[]) => {
      if (!activeOrgId) return;
      setSavingSection(section);
      setSaveMessage(null);

      try {
        const res = await fetch(`/api/organizations/${activeOrgId}/settings`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ settings: keyValuePairs }),
        });

        if (res.ok) {
          setSaveMessage({ type: "success", text: `${section} policy saved successfully.` });
          // Refresh settings
          const settingsRes = await fetch(`/api/organizations/${activeOrgId}/settings`);
          if (settingsRes.ok) {
            const data = await settingsRes.json();
            setSettings(data.settings || []);
          }
        } else {
          setSaveMessage({ type: "error", text: `Failed to save ${section.toLowerCase()} policy.` });
        }
      } catch {
        setSaveMessage({ type: "error", text: `Network error saving ${section.toLowerCase()} policy.` });
      } finally {
        setSavingSection(null);
        setTimeout(() => setSaveMessage(null), 4000);
      }
    },
    [activeOrgId],
  );

  // ── Computed: Security checklist ──
  const securityChecks = useMemo<SecurityCheck[]>(() => {
    const mfaEnabled =
      getSettingValue(settings, "security.mfa.enabled") === "true";
    const auditActive = auditLogs.length > 0;
    const hasCustomRoles = roles.some((r) => !r.isDefault);
    const sessionTimeoutSet =
      getSettingValue(settings, "security.session.timeout") !== undefined &&
      getSettingValue(settings, "security.session.timeout") !== "";
    const ipAllowlist =
      getSettingValue(settings, "security.ip.allowlist") !== undefined &&
      getSettingValue(settings, "security.ip.allowlist") !== "";

    return [
      {
        id: "mfa",
        label: "MFA Enabled",
        description: "Multi-factor authentication is required for all users",
        status: mfaEnabled ? "enabled" : "not_configured",
        icon: Fingerprint,
      },
      {
        id: "audit",
        label: "Audit Logging Active",
        description: "All actions are being tracked and recorded",
        status: auditActive ? "enabled" : "not_configured",
        icon: FileText,
      },
      {
        id: "rbac",
        label: "RBAC Configured",
        description: "Custom roles and permissions are defined",
        status: hasCustomRoles ? "enabled" : "not_configured",
        icon: UserCog,
      },
      {
        id: "session",
        label: "Session Timeout Set",
        description: "Automatic session expiration is configured",
        status: sessionTimeoutSet ? "enabled" : "not_configured",
        icon: Timer,
      },
      {
        id: "ip",
        label: "IP Allowlist",
        description: "Access is restricted to allowed IP addresses",
        status: ipAllowlist ? "enabled" : "not_configured",
        icon: Globe,
      },
      {
        id: "encryption",
        label: "Encryption at Rest",
        description: "All data is encrypted at rest using AES-256",
        status: "enabled",
        icon: HardDrive,
      },
    ];
  }, [settings, auditLogs, roles]);

  // ── Computed: Security score ──
  const securityScore = useMemo(() => {
    const weights: Record<CheckStatus, number> = {
      enabled: 1,
      not_configured: 0.5,
      disabled: 0,
    };
    const raw =
      securityChecks.reduce((sum, c) => sum + weights[c.status], 0) /
      securityChecks.length *
      100;
    return Math.round(raw);
  }, [securityChecks]);

  const scoreColor =
    securityScore > 80
      ? "text-emerald-400"
      : securityScore > 50
        ? "text-amber-400"
        : "text-red-400";

  const scoreRingColor =
    securityScore > 80
      ? "stroke-emerald-400"
      : securityScore > 50
        ? "stroke-amber-400"
        : "stroke-red-400";

  const scoreBgColor =
    securityScore > 80
      ? "bg-emerald-500/10"
      : securityScore > 50
        ? "bg-amber-500/10"
        : "bg-red-500/10";

  const scoreLabel =
    securityScore > 80 ? "Good" : securityScore > 50 ? "Fair" : "Poor";

  // ── Computed: Filtered audit logs ──
  const filteredLogs = useMemo(() => {
    let logs = auditLogs;
    if (actionFilter !== "all") {
      logs = logs.filter(
        (l) => l.action.toLowerCase() === actionFilter.toLowerCase(),
      );
    }
    return logs.slice(0, 15);
  }, [auditLogs, actionFilter]);

  const uniqueActions = useMemo(
    () => [...new Set(auditLogs.map((l) => l.action))],
    [auditLogs],
  );

  // ── Org guard ──
  if (!activeOrgId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">
            <span className="gradient-text">Security Settings</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enterprise security and governance for your organization
          </p>
        </div>
        <Card className="glass border-purple-500/10 p-8 sm:p-12 text-center">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-bold text-lg mb-2">No Organization Selected</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Select an organization to manage security settings, policies, and
            access control.
          </p>
          <Button
            className="btn-gradient text-white"
            onClick={() => navigate("organizations")}
          >
            Select Organization
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Card>
      </div>
    );
  }

  // ── Error state ──
  if (error && !loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">
            <span className="gradient-text">Security Settings</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enterprise security and governance
          </p>
        </div>
        <Card className="glass border-red-500/20 bg-red-500/5 p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="font-bold text-lg mb-2">Failed to Load</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            {error}
          </p>
          <Button
            variant="outline"
            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
            onClick={fetchData}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  // ── Loading state ──
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-11 w-full max-w-lg rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-72 glass rounded-xl" />
          <Skeleton className="h-72 glass rounded-xl lg:col-span-2" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">
          <span className="gradient-text">Security Settings</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Enterprise security and governance for your organization
        </p>
      </div>

      {/* ── Toast-like save message ── */}
      <AnimatePresence>
        {saveMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className="overflow-hidden"
          >
            <div
              className={`flex items-center gap-3 p-4 rounded-lg border ${
                saveMessage.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-red-500/10 border-red-500/30 text-red-300"
              }`}
            >
              {saveMessage.type === "success" ? (
                <Check className="h-5 w-5 flex-shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              )}
              <p className="text-sm font-medium">{saveMessage.text}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Tabs ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="glass border-purple-500/10 bg-purple-500/5 w-full sm:w-auto">
            <TabsTrigger
              value="overview"
              className="data-[state=active]:bg-purple-500/15 data-[state=active]:text-purple-300"
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="policies"
              className="data-[state=active]:bg-purple-500/15 data-[state=active]:text-purple-300"
            >
              <Shield className="mr-2 h-4 w-4" />
              Policies
            </TabsTrigger>
            <TabsTrigger
              value="access"
              className="data-[state=active]:bg-purple-500/15 data-[state=active]:text-purple-300"
            >
              <Users className="mr-2 h-4 w-4" />
              Access Control
            </TabsTrigger>
            <TabsTrigger
              value="audit"
              className="data-[state=active]:bg-purple-500/15 data-[state=active]:text-purple-300"
            >
              <FileText className="mr-2 h-4 w-4" />
              Audit Trail
            </TabsTrigger>
          </TabsList>

          {/* ══════════════════════════════════════════
              TAB 1: OVERVIEW
          ══════════════════════════════════════════ */}
          <TabsContent value="overview" className="space-y-6">
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              {/* Security Score Card */}
              <motion.div variants={fadeUp} className="lg:col-span-1">
                <Card className="glass border-purple-500/10 h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <ShieldCheck className="h-4 w-4" />
                      Security Score
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center justify-center py-6">
                    <div className={`relative w-36 h-36 rounded-full ${scoreBgColor} flex items-center justify-center mb-4`}>
                      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 144 144">
                        <circle
                          cx="72"
                          cy="72"
                          r="62"
                          fill="none"
                          strokeWidth="8"
                          className="stroke-white/5"
                        />
                        <circle
                          cx="72"
                          cy="72"
                          r="62"
                          fill="none"
                          strokeWidth="8"
                          strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 62}`}
                          strokeDashoffset={
                            2 * Math.PI * 62 * (1 - securityScore / 100)
                          }
                          className={`${scoreRingColor} transition-all duration-700`}
                        />
                      </svg>
                      <div className="text-center z-10">
                        <span className={`text-5xl font-bold ${scoreColor}`}>
                          {securityScore}
                        </span>
                        <p className="text-xs text-muted-foreground mt-1">
                          out of 100
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={STATUS_BADGE_STYLES[securityScore > 80 ? "enabled" : securityScore > 50 ? "not_configured" : "disabled"]}
                    >
                      {scoreLabel}
                    </Badge>
                    <p className="text-xs text-muted-foreground text-center mt-3 px-4">
                      Based on {securityChecks.filter((c) => c.status === "enabled").length} of{" "}
                      {securityChecks.length} security features enabled
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Security Checklist */}
              <motion.div variants={fadeUp} className="lg:col-span-2">
                <Card className="glass border-purple-500/10 h-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lock className="h-5 w-5 text-purple-400" />
                      Security Checklist
                    </CardTitle>
                    <CardDescription>
                      Review and configure your organization&apos;s security posture
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {securityChecks.map((check) => {
                        const Icon = check.icon;
                        return (
                          <div
                            key={check.id}
                            className="flex items-center gap-4 p-3 rounded-lg border border-purple-500/10 bg-purple-500/[0.03] hover:bg-purple-500/[0.06] transition-colors"
                          >
                            <div
                              className={`flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0 ${
                                check.status === "enabled"
                                  ? "bg-emerald-500/15 text-emerald-400"
                                  : check.status === "not_configured"
                                    ? "bg-amber-500/15 text-amber-400"
                                    : "bg-red-500/15 text-red-400"
                              }`}
                            >
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium">{check.label}</p>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${STATUS_BADGE_STYLES[check.status]}`}
                                >
                                  {STATUS_LABELS[check.status]}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {check.description}
                              </p>
                            </div>
                            <CircleDot
                              className={`h-3 w-3 flex-shrink-0 ${
                                check.status === "enabled"
                                  ? "text-emerald-400"
                                  : check.status === "not_configured"
                                    ? "text-amber-400"
                                    : "text-red-400"
                              }`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>

            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="glass border-purple-500/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-purple-400" />
                    Quick Actions
                  </CardTitle>
                  <CardDescription>
                    Common security configuration tasks
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="outline"
                      className="border-purple-500/20 hover:bg-purple-500/10 hover:text-purple-300"
                      onClick={() => navigate("securitySettings", { tab: "policies" })}
                    >
                      <KeyRound className="mr-2 h-4 w-4" />
                      Configure MFA
                    </Button>
                    <Button
                      variant="outline"
                      className="border-purple-500/20 hover:bg-purple-500/10 hover:text-purple-300"
                      onClick={() => navigate("auditLog")}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View Audit Log
                    </Button>
                    <Button
                      variant="outline"
                      className="border-purple-500/20 hover:bg-purple-500/10 hover:text-purple-300"
                      onClick={() => navigate("securitySettings", { tab: "access" })}
                    >
                      <UserCog className="mr-2 h-4 w-4" />
                      Manage Roles
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* ══════════════════════════════════════════
              TAB 2: POLICIES
          ══════════════════════════════════════════ */}
          <TabsContent value="policies" className="space-y-6">
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 lg:grid-cols-1 gap-6"
            >
              {/* Session Policy */}
              <motion.div variants={fadeUp}>
                <Card className="glass border-purple-500/10">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-purple-400" />
                      Session Policy
                    </CardTitle>
                    <CardDescription>
                      Control how user sessions are managed and expired
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <Label htmlFor="session-timeout">Timeout Duration</Label>
                        <Select value={sessionTimeout} onValueChange={setSessionTimeout}>
                          <SelectTrigger className="bg-purple-500/5 border-purple-500/10">
                            <Timer className="mr-2 h-4 w-4 text-muted-foreground" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="glass border-purple-500/20">
                            {SESSION_TIMEOUT_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="max-concurrent">Max Concurrent Sessions</Label>
                        <Input
                          id="max-concurrent"
                          type="number"
                          min="1"
                          max="10"
                          value={maxConcurrent}
                          onChange={(e) => setMaxConcurrent(e.target.value)}
                          className="bg-purple-500/5 border-purple-500/10 focus:border-purple-500/30"
                        />
                        <p className="text-[10px] text-muted-foreground">
                          Number of simultaneous sessions per user (1–10)
                        </p>
                      </div>
                    </div>
                    <Separator className="bg-purple-500/10" />
                    <div className="flex justify-end">
                      <Button
                        className="btn-gradient text-white"
                        disabled={savingSection === "Session"}
                        onClick={() =>
                          savePolicies("Session", [
                            { key: "security.session.timeout", value: sessionTimeout },
                            { key: "security.session.maxConcurrent", value: maxConcurrent },
                          ])
                        }
                      >
                        {savingSection === "Session" ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-4 w-4" />
                        )}
                        Save Session Policy
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Agent Policy */}
              <motion.div variants={fadeUp}>
                <Card className="glass border-purple-500/10">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bot className="h-5 w-5 text-purple-400" />
                      Agent Policy
                    </CardTitle>
                    <CardDescription>
                      Control AI agent autonomy and approval requirements
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <Label htmlFor="max-autonomy">Max Autonomy Level</Label>
                        <Select value={maxAutonomy} onValueChange={setMaxAutonomy}>
                          <SelectTrigger className="bg-purple-500/5 border-purple-500/10">
                            <Shield className="mr-2 h-4 w-4 text-muted-foreground" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="glass border-purple-500/20">
                            {AUTONOMY_LEVELS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground">
                          L4+ agents can execute actions without real-time oversight
                        </p>
                      </div>
                      <div className="space-y-5 pt-6">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor="require-approval">Require Human Approval (L4+)</Label>
                            <p className="text-[10px] text-muted-foreground">
                              High-autonomy agents need human sign-off
                            </p>
                          </div>
                          <Switch
                            id="require-approval"
                            checked={requireApproval}
                            onCheckedChange={setRequireApproval}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor="allow-delegation">Agent-to-Agent Delegation</Label>
                            <p className="text-[10px] text-muted-foreground">
                              Allow agents to delegate tasks to other agents
                            </p>
                          </div>
                          <Switch
                            id="allow-delegation"
                            checked={allowDelegation}
                            onCheckedChange={setAllowDelegation}
                          />
                        </div>
                      </div>
                    </div>
                    <Separator className="bg-purple-500/10" />
                    <div className="flex justify-end">
                      <Button
                        className="btn-gradient text-white"
                        disabled={savingSection === "Agent"}
                        onClick={() =>
                          savePolicies("Agent", [
                            { key: "security.agent.maxAutonomy", value: maxAutonomy },
                            { key: "security.agent.requireApproval", value: String(requireApproval) },
                            { key: "security.agent.allowDelegation", value: String(allowDelegation) },
                          ])
                        }
                      >
                        {savingSection === "Agent" ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-4 w-4" />
                        )}
                        Save Agent Policy
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Data Policy */}
              <motion.div variants={fadeUp}>
                <Card className="glass border-purple-500/10">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5 text-purple-400" />
                      Data Policy
                    </CardTitle>
                    <CardDescription>
                      Manage data retention, export, and audit log storage
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <Label htmlFor="data-retention">Data Retention Period</Label>
                        <Select value={dataRetention} onValueChange={setDataRetention}>
                          <SelectTrigger className="bg-purple-500/5 border-purple-500/10">
                            <Database className="mr-2 h-4 w-4 text-muted-foreground" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="glass border-purple-500/20">
                            {RETENTION_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="audit-retention">Audit Log Retention</Label>
                        <Select value={auditRetention} onValueChange={setAuditRetention}>
                          <SelectTrigger className="bg-purple-500/5 border-purple-500/10">
                            <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="glass border-purple-500/20">
                            {AUDIT_RETENTION_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="allow-export">Allow Data Export</Label>
                        <p className="text-[10px] text-muted-foreground">
                          Let organization members export their data
                        </p>
                      </div>
                      <Switch
                        id="allow-export"
                        checked={allowExport}
                        onCheckedChange={setAllowExport}
                      />
                    </div>
                    <Separator className="bg-purple-500/10" />
                    <div className="flex justify-end">
                      <Button
                        className="btn-gradient text-white"
                        disabled={savingSection === "Data"}
                        onClick={() =>
                          savePolicies("Data", [
                            { key: "security.data.retention", value: dataRetention },
                            { key: "security.data.allowExport", value: String(allowExport) },
                            { key: "security.audit.retention", value: auditRetention },
                          ])
                        }
                      >
                        {savingSection === "Data" ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-4 w-4" />
                        )}
                        Save Data Policy
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          </TabsContent>

          {/* ══════════════════════════════════════════
              TAB 3: ACCESS CONTROL
          ══════════════════════════════════════════ */}
          <TabsContent value="access" className="space-y-6">
            {/* Members Table */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="glass border-purple-500/10 overflow-hidden">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-purple-400" />
                        Members
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {members.length} member{members.length !== 1 ? "s" : ""} in this organization
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-purple-500/20 hover:bg-purple-500/10"
                      onClick={() =>
                        document.getElementById("roles-section")?.scrollIntoView({ behavior: "smooth" })
                      }
                    >
                      <UserCog className="mr-2 h-4 w-4" />
                      Manage Roles
                      <ChevronRight className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {members.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      No members found in this organization.
                    </div>
                  ) : (
                    <>
                      {/* Desktop table */}
                      <div className="hidden md:block">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-purple-500/10 hover:bg-transparent">
                              <TableHead>Name</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Role</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Joined</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {members.map((member) => (
                              <TableRow
                                key={member.id}
                                className="border-purple-500/10 hover:bg-purple-500/5"
                              >
                                <TableCell className="font-medium">
                                  {member.user.name}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                  {member.user.email}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="border-purple-500/30 text-purple-300">
                                    {member.role}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] ${MEMBER_STATUS_STYLES[member.status] || MEMBER_STATUS_STYLES.Pending}`}
                                  >
                                    {member.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {formatTimestamp(member.joinedAt)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Mobile cards */}
                      <div className="md:hidden p-4 space-y-3 max-h-96 overflow-y-auto">
                        {members.map((member) => (
                          <div
                            key={member.id}
                            className="p-3 rounded-lg border border-purple-500/10 bg-purple-500/[0.03]"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium">
                                {member.user.name}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${MEMBER_STATUS_STYLES[member.status] || MEMBER_STATUS_STYLES.Pending}`}
                              >
                                {member.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">
                              {member.user.email}
                            </p>
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className="border-purple-500/30 text-purple-300 text-[10px]">
                                {member.role}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">
                                Joined {formatTimestamp(member.joinedAt)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Roles Section */}
            <motion.div
              id="roles-section"
              initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                >
              <Card className="glass border-purple-500/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserCog className="h-5 w-5 text-purple-400" />
                    Roles
                  </CardTitle>
                  <CardDescription>
                    {roles.length} role{roles.length !== 1 ? "s" : ""} defined for this organization
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {roles.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      No roles configured. Create roles to manage permissions.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                      {roles.map((role) => (
                        <div
                          key={role.id}
                          className="p-4 rounded-lg border border-purple-500/10 bg-purple-500/[0.03] hover:bg-purple-500/[0.06] transition-colors card-hover"
                        >
                          <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold">{role.name}</h4>
                          {role.isDefault && (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-purple-500/10 text-purple-300 border-purple-500/20"
                            >
                              Default
                            </Badge>
                          )}
                        </div>
                          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                            {role.description || "No description provided"}
                          </p>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <KeyRound className="h-3 w-3" />
                            <span>
                              {role.permissionsCount} permission{role.permissionsCount !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* ══════════════════════════════════════════
              TAB 4: AUDIT TRAIL
          ══════════════════════════════════════════ */}
          <TabsContent value="audit" className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="glass border-purple-500/10 overflow-hidden">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-purple-400" />
                        Recent Audit Trail
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Latest {filteredLogs.length} of {auditLogs.length} log entries
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                      {uniqueActions.length > 0 && (
                        <Select value={actionFilter} onValueChange={setActionFilter}>
                          <SelectTrigger className="w-36 bg-purple-500/5 border-purple-500/10">
                            <SelectValue placeholder="Action" />
                          </SelectTrigger>
                          <SelectContent className="glass border-purple-500/20">
                            <SelectItem value="all">All Actions</SelectItem>
                            {uniqueActions.map((action) => (
                              <SelectItem key={action} value={action}>
                                {action.charAt(0).toUpperCase() + action.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-purple-500/20 hover:bg-purple-500/10"
                        onClick={() => navigate("auditLog")}
                      >
                        View Full Audit Log
                        <ChevronRight className="ml-1 h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {filteredLogs.length === 0 ? (
                    <div className="p-8 sm:p-12 text-center">
                      <Shield className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">
                        {actionFilter !== "all"
                          ? "No logs match the selected filter."
                          : "No audit logs recorded yet."}
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Desktop table */}
                      <div className="hidden md:block">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-purple-500/10 hover:bg-transparent">
                              <TableHead className="w-40">Timestamp</TableHead>
                              <TableHead className="w-28">Action</TableHead>
                              <TableHead className="w-36">Actor</TableHead>
                              <TableHead>Resource</TableHead>
                              <TableHead>Details</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredLogs.map((log) => (
                              <TableRow
                                key={log.id}
                                className="border-purple-500/10 hover:bg-purple-500/5"
                              >
                                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                  {formatTimestamp(log.createdAt)}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] ${ACTION_STYLES[log.action.toLowerCase()] || ACTION_STYLES.update}`}
                                  >
                                    {log.action}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm">
                                  {log.actorName}
                                </TableCell>
                                <TableCell className="text-sm max-w-[200px] truncate">
                                  {log.resource}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate">
                                  {log.details}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Mobile cards */}
                      <div className="md:hidden p-4 space-y-3 max-h-96 overflow-y-auto">
                        {filteredLogs.map((log) => (
                          <div
                            key={log.id}
                            className="p-3 rounded-lg border border-purple-500/10 bg-purple-500/[0.03]"
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${ACTION_STYLES[log.action.toLowerCase()] || ACTION_STYLES.update}`}
                              >
                                {log.action}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">
                                {formatTimestamp(log.createdAt)}
                              </span>
                            </div>
                            <p className="text-sm font-medium mb-1">{log.actorName}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {log.resource}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-1 truncate">
                              {log.details}
                            </p>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}


