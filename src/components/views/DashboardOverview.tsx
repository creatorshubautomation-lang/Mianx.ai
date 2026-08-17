"use client";

import { useEffect, useState, useMemo } from "react";
import { useApp, useT } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Search,
  PlayCircle,
  Bot,
  Rocket,
  Workflow,
  Plug,
  CreditCard,
  ScrollText,
  Building2,
  Users,
  Wallet,
  Settings,
  AlertTriangle,
  UserPlus,
  ShieldCheck,
  FileDown,
  Zap,
  Store,
  CircleCheckBig,
  Circle,
  Globe,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
}

const orgActivityItems = [
  {
    id: "a1",
    action: "Agent completed workflow step",
    context: "Design Pipeline",
    time: "3 min ago",
    icon: Bot,
    color: "from-purple-500 to-violet-500",
  },
  {
    id: "a2",
    action: "New integration connected",
    context: "Slack Workspace",
    time: "18 min ago",
    icon: Plug,
    color: "from-cyan-500 to-blue-500",
  },
  {
    id: "a3",
    action: "Usage threshold alert at 80%",
    context: "API Calls",
    time: "45 min ago",
    icon: AlertTriangle,
    color: "from-amber-500 to-orange-500",
  },
  {
    id: "a4",
    action: "Team member joined organization",
    context: "Sarah Chen",
    time: "1 hour ago",
    icon: UserPlus,
    color: "from-emerald-500 to-green-500",
  },
  {
    id: "a5",
    action: "Workflow approval pending",
    context: "Content Review",
    time: "2 hours ago",
    icon: ShieldCheck,
    color: "from-pink-500 to-rose-500",
  },
  {
    id: "a6",
    action: "Billing cycle started",
    context: "December 2024",
    time: "3 hours ago",
    icon: CreditCard,
    color: "from-violet-500 to-purple-500",
  },
  {
    id: "a7",
    action: "Audit log exported",
    context: "Q4 Compliance",
    time: "5 hours ago",
    icon: FileDown,
    color: "from-cyan-500 to-blue-500",
  },
  {
    id: "a8",
    action: "Agent autonomy level changed",
    context: "Code Agent → Level 3",
    time: "Yesterday",
    icon: Zap,
    color: "from-amber-500 to-orange-500",
  },
];

type ViewKey =
  | "dashboard"
  | "projects"
  | "newProject"
  | "workflows"
  | "integrations"
  | "aiAgents"
  | "billing"
  | "auditLog"
  | "organizations"
  | "orgSettings"
  | "missions"
  | "commandCenter"
  | "budget"
  | "trustCenter"
  | "agentPerformance"
  | "toolRegistry"
  | "approvals"
  | "support"
  | "settings";

export function DashboardOverview() {
  const t = useT();
  const { navigate, setSelectedProject, activeOrgId, organizations } =
    useApp();
  const { data: session } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const activeOrg = useMemo(
    () => organizations.find((o) => o.id === activeOrgId) ?? null,
    [organizations, activeOrgId],
  );
  const hasOrg = !!activeOrg;

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

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.projectType.toLowerCase().includes(q) ||
        p.status.toLowerCase().includes(q),
    );
  }, [projects, searchQuery]);

  // ---------- Stats ----------
  const orgStats = [
    {
      label: "Active Agents",
      value: 12,
      icon: Bot,
      color: "from-purple-500 to-violet-500",
    },
    {
      label: "Running Workflows",
      value: 8,
      icon: Workflow,
      color: "from-cyan-500 to-blue-500",
    },
    {
      label: "Integrations",
      value: 15,
      icon: Plug,
      color: "from-emerald-500 to-green-500",
    },
    {
      label: "Tasks This Week",
      value: 47,
      icon: CheckCircle2,
      color: "from-amber-500 to-orange-500",
    },
    {
      label: "Team Members",
      value: activeOrg?.memberCount ?? 0,
      icon: Users,
      color: "from-pink-500 to-rose-500",
    },
    {
      label: "Budget Used",
      value: "64%" as unknown as number,
      displayText: "64%",
      icon: Wallet,
      color: "from-violet-500 to-purple-500",
    },
  ];

  const userStats = [
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
    {
      label: "Organizations",
      value: organizations.length,
      icon: Building2,
      color: "from-amber-500 to-orange-500",
    },
    {
      label: "Missions",
      value: 3,
      icon: Rocket,
      color: "from-violet-500 to-purple-500",
    },
  ];

  const stats = hasOrg ? orgStats : userStats;

  // ---------- Quick Actions ----------
  const orgQuickActions = [
    {
      key: "newProject" as ViewKey,
      icon: PlusCircle,
      label: "New Project",
      desc: "Start creating with AI",
      color: "from-purple-500 to-violet-500",
    },
    {
      key: "aiAgents" as ViewKey,
      icon: Bot,
      label: "AI Agents",
      desc: "Manage your AI team",
      color: "from-cyan-500 to-blue-500",
    },
    {
      key: "workflows" as ViewKey,
      icon: Workflow,
      label: "Workflows",
      desc: "Automate processes",
      color: "from-emerald-500 to-green-500",
    },
    {
      key: "integrations" as ViewKey,
      icon: Plug,
      label: "Integrations",
      desc: "Connect your tools",
      color: "from-amber-500 to-orange-500",
    },
    {
      key: "billing" as ViewKey,
      icon: CreditCard,
      label: "Billing",
      desc: "Manage subscriptions",
      color: "from-pink-500 to-rose-500",
    },
    {
      key: "auditLog" as ViewKey,
      icon: ScrollText,
      label: "Audit Log",
      desc: "Review activity",
      color: "from-violet-500 to-purple-500",
    },
  ];

  const userQuickActions = [
    {
      key: "newProject" as ViewKey,
      icon: PlusCircle,
      label: "New Project",
      desc: "Start creating with AI",
      color: "from-purple-500 to-violet-500",
    },
    {
      key: "organizations" as ViewKey,
      icon: Building2,
      label: "My Organizations",
      desc: "Manage your orgs",
      color: "from-cyan-500 to-blue-500",
    },
    {
      key: "projects" as ViewKey,
      icon: Bot,
      label: "View Agents",
      desc: "See your AI team",
      color: "from-emerald-500 to-green-500",
    },
    {
      key: "missions" as ViewKey,
      icon: Rocket,
      label: "Missions",
      desc: "Track objectives",
      color: "from-amber-500 to-orange-500",
    },
    {
      key: "commandCenter" as ViewKey,
      icon: Activity,
      label: "Command Center",
      desc: "Platform overview",
      color: "from-pink-500 to-rose-500",
    },
    {
      key: "settings" as ViewKey,
      icon: Store,
      label: "Marketplace",
      desc: "Browse extensions",
      color: "from-violet-500 to-purple-500",
    },
  ];

  const quickActions = hasOrg ? orgQuickActions : userQuickActions;

  const handleQuickAction = (key: ViewKey) => {
    navigate(key);
  };

  // ---------- Getting Started Checklist ----------
  const checklistItems = [
    {
      id: "c1",
      label: "Create an organization",
      done: organizations.length > 0,
    },
    {
      id: "c2",
      label: "Invite team members",
      done: organizations.some((o) => (o.memberCount ?? 0) > 1),
    },
    {
      id: "c3",
      label: "Deploy your first AI agent",
      done: projects.some(
        (p) => p.agents && p.agents.length > 0,
      ),
    },
    {
      id: "c4",
      label: "Set up a workflow",
      done: false,
    },
    {
      id: "c5",
      label: "Connect an integration",
      done: false,
    },
    {
      id: "c6",
      label: "Configure billing",
      done: false,
    },
  ];

  const completedChecklist = checklistItems.filter((c) => c.done).length;
  const checklistProgress = Math.round(
    (completedChecklist / checklistItems.length) * 100,
  );

  const greeting = getGreeting();
  const firstName = session?.user?.name?.split(" ")[0] || "there";

  return (
    <div className="space-y-6">
      {/* Header with time-based greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">
            {greeting},{" "}
            <span className="gradient-text">{firstName}</span> 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {hasOrg
              ? "Here's what's happening across your organization."
              : "Here's what your AI agents have been up to."}
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

      {/* Org Context Banner */}
      <AnimatePresence mode="wait">
        {hasOrg ? (
          <motion.div
            key="org-banner"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            <Card className="glass border-purple-500/15 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center flex-shrink-0">
                    <Building2 className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        Working in:
                      </span>
                      <span className="font-semibold text-sm">
                        {activeOrg!.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        <Users className="inline h-3 w-3 mr-1" />
                        {activeOrg!.memberCount ?? 0} members
                      </span>
                      <span className="text-xs text-muted-foreground">
                        <Globe className="inline h-3 w-3 mr-1" />
                        {activeOrg!.domainCount ?? 0} domains
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("orgSettings")}
                  className="text-xs text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
                >
                  <Settings className="mr-1.5 h-3.5 w-3.5" />
                  Settings
                </Button>
              </div>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="no-org-banner"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            <Card className="glass border-amber-500/15 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center flex-shrink-0">
                    <Building2 className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      Select an organization to unlock full platform features
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Manage teams, workflows, integrations, and more within an
                      organization.
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("organizations")}
                  className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
                >
                  <Building2 className="mr-1.5 h-3.5 w-3.5" />
                  View Organizations
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* V2 Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
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
              <div className="text-2xl font-bold">
                {(s as { displayText?: string }).displayText ?? s.value}
              </div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {quickActions.map((action, i) => (
            <motion.button
              key={action.key}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.05 }}
              onClick={() => handleQuickAction(action.key)}
              className="group"
            >
              <Card className="glass border-purple-500/10 p-4 card-hover text-left h-full">
                <div
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${action.color} mb-3 group-hover:scale-110 transition-transform`}
                >
                  <action.icon className="h-5 w-5 text-white" />
                </div>
                <div className="font-semibold text-sm">{action.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {action.desc}
                </div>
              </Card>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Two-Column Layout Below */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: Projects Section */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              {hasOrg ? "Recent Projects" : t("dash.projects")}
            </h2>
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

          {/* Search / Filter */}
          {projects.length > 0 && (
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-purple-500/5 border-purple-500/10 focus:border-purple-500/30"
              />
            </div>
          )}

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
            <Card className="glass border-purple-500/10 overflow-hidden">
              <div className="p-8 sm:p-12 text-center">
                {/* Illustration-style visual */}
                <div className="relative mx-auto w-32 h-32 mb-6">
                  {/* Outer glow ring */}
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 animate-pulse" />
                  {/* Middle ring */}
                  <div className="absolute inset-3 rounded-full bg-gradient-to-br from-purple-500/10 to-cyan-500/10" />
                  {/* Inner circle */}
                  <div className="absolute inset-6 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center">
                    <Sparkles className="h-10 w-10 text-purple-400" />
                  </div>
                  {/* Floating orbs */}
                  <motion.div
                    className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500"
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <motion.div
                    className="absolute -bottom-1 -left-1 h-4 w-4 rounded-full bg-gradient-to-br from-pink-400 to-rose-500"
                    animate={{ y: [0, 4, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                  />
                </div>
                <h3 className="font-bold text-xl mb-2">
                  {hasOrg
                    ? `No projects in ${activeOrg!.name}`
                    : t("dash.noProjects")}
                </h3>
                <p className="text-sm text-muted-foreground mb-2 max-w-sm mx-auto">
                  {hasOrg
                    ? "This organization doesn't have any projects yet. Create your first project and let AI agents get to work."
                    : "Your creative canvas is waiting! Create your first project and watch AI agents design, build, and deliver in record time."}
                </p>
                <p className="text-xs text-purple-400/80 mb-6">
                  ⚡ It only takes 30 seconds to get started
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    onClick={() => navigate("newProject")}
                    className="btn-gradient text-white"
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    {t("dash.createProject")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      window.open(
                        "https://mianx.ai/docs/getting-started",
                        "_blank",
                      )
                    }
                    className="border-purple-500/20"
                  >
                    <PlayCircle className="mr-2 h-4 w-4" />
                    Watch Tutorial
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredProjects.length === 0 ? (
                <div className="text-center py-8">
                  <Search className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No projects match &quot;{searchQuery}&quot;
                  </p>
                </div>
              ) : (
                filteredProjects.slice(0, 5).map((p) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card
                      className="glass border-purple-500/10 p-5 card-hover cursor-pointer"
                      onClick={() => {
                        setSelectedProject(p.id);
                        navigate("projectDetail", { id: p.id });
                      }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold truncate">
                              {p.title}
                            </h3>
                            <Badge
                              variant="outline"
                              className="text-xs glass flex-shrink-0"
                            >
                              {p.projectType}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={
                                p.status === "COMPLETED"
                                  ? "text-xs border-green-500/30 text-green-400"
                                  : p.status === "CANCELLED"
                                    ? "text-xs border-red-500/30 text-red-400"
                                    : "text-xs border-purple-500/30 text-purple-400"
                              }
                            >
                              {p.status}
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
                            <Progress
                              value={p.progress}
                              className="h-1.5 flex-1"
                            />
                            <span className="text-xs text-muted-foreground w-10 text-right">
                              {p.progress}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))
              )}
            </div>
          )}
        </div>

        {/* RIGHT: Platform Activity / Getting Started */}
        <div className="lg:col-span-1">
          <AnimatePresence mode="wait">
            {hasOrg ? (
              <motion.div
                key="platform-activity"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">
                    Platform Activity
                  </h2>
                  <Badge variant="outline" className="text-xs glass">
                    <Activity className="mr-1 h-3 w-3" />
                    Live
                  </Badge>
                </div>
                <Card className="glass border-purple-500/10 p-4">
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {orgActivityItems.map((item, i) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + i * 0.06 }}
                        className="flex gap-3"
                      >
                        <div
                          className={`flex-shrink-0 h-8 w-8 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center`}
                        >
                          <item.icon className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-tight">
                            {item.action}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {item.context} · {item.time}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                key="getting-started"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Getting Started</h2>
                  <Badge
                    variant="outline"
                    className="text-xs glass"
                  >
                    {completedChecklist}/{checklistItems.length}
                  </Badge>
                </div>
                <Card className="glass border-purple-500/10 p-4">
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground">
                        Setup progress
                      </span>
                      <span className="text-xs font-medium">
                        {checklistProgress}%
                      </span>
                    </div>
                    <Progress value={checklistProgress} className="h-1.5" />
                  </div>
                  <div className="space-y-3">
                    {checklistItems.map((item, i) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + i * 0.06 }}
                        className="flex items-center gap-3"
                      >
                        {item.done ? (
                          <div className="flex-shrink-0 h-6 w-6 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                            <CircleCheckBig className="h-3.5 w-3.5 text-white" />
                          </div>
                        ) : (
                          <div className="flex-shrink-0 h-6 w-6 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center">
                            <Circle className="h-2 w-2 text-muted-foreground/40" />
                          </div>
                        )}
                        <span
                          className={`text-sm ${
                            item.done
                              ? "text-muted-foreground line-through"
                              : "font-medium"
                          }`}
                        >
                          {item.label}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                  <div className="mt-5 pt-4 border-t border-white/5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs border-purple-500/20 text-purple-400 hover:bg-purple-500/10 hover:text-purple-300"
                      onClick={() =>
                        window.open(
                          "https://mianx.ai/docs/getting-started",
                          "_blank",
                        )
                      }
                    >
                      <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
                      Read the Quick Start Guide
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
