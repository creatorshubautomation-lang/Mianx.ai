"use client";

import { useApp, useT } from "@/lib/store";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AgentAvatar } from "../mianx/AgentAvatar";
import { AGENT_CATALOG, TEAM_INFO, type AgentTeamType } from "@/lib/agents";
import { getPlatformStats } from "@/lib/platform-stats";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Sparkles,
  ArrowRight,
  Zap,
  Shield,
  Clock,
  Globe,
  Cpu,
  CheckCircle2,
  Bot,
  Workflow,
  Rocket,
  Star,
  Quote,
  HelpCircle,
  Users,
  Award,
  Building2,
  CreditCard,
  Plug,
  ShieldCheck,
  Layers,
  Lock,
  Server,
  Headphones,
  FileCheck,
  Activity,
} from "lucide-react";
import { motion } from "framer-motion";

/* ---------- Counter Animation Hook ---------- */
function useCountUp(target: number, duration = 1500) {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const startCounting = useCallback(() => {
    if (hasStarted) return;
    setHasStarted(true);
    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, hasStarted]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          startCounting();
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [startCounting]);

  return { count, ref };
}

/* ---------- Animated Stat Card ---------- */
function AnimatedStat({
  value,
  label,
  icon: Icon,
}: {
  value: number;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const { count, ref } = useCountUp(value);
  return (
    <Card
      ref={ref}
      className="glass border-purple-500/10 p-6 text-center card-hover"
    >
      <Icon className="mx-auto h-6 w-6 text-purple-400 mb-2" />
      <div className="text-2xl sm:text-3xl font-bold gradient-text">
        {label.includes("%") ? count.toFixed(1) : count.toLocaleString()}
        {label.includes("%") ? "%" : "+"}
      </div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </Card>
  );
}

/* ---------- Pulsing CTA Button ---------- */
function PulsingButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <motion.div
      animate={{ scale: [1, 1.02, 1] }}
      transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
      className="inline-block"
    >
      <Button
        size="lg"
        onClick={onClick}
        className="btn-gradient text-white px-10 py-7 text-lg font-semibold shadow-[0_0_30px_rgba(168,85,247,0.4)] hover:shadow-[0_0_50px_rgba(168,85,247,0.6)] transition-shadow duration-300"
      >
        {children}
      </Button>
    </motion.div>
  );
}

export function HomeView() {
  const t = useT();
  const { navigate, setAuthModal, activeOrgId } = useApp();
  const { data: session } = useSession();

  const teams = Object.keys(TEAM_INFO) as AgentTeamType[];

  const platformStats = getPlatformStats();

  /* ---------- Data ---------- */

  const stats = [
    { value: 1500, label: "Projects Delivered", icon: Rocket },
    { value: 500, label: "Active Organizations", icon: Building2 },
    { value: 50, label: "AI Agents Deployed", icon: Bot },
    { value: 99.9, label: "Platform Uptime", icon: Clock },
  ];

  const features = [
    {
      icon: Building2,
      title: "Multi-Tenant Architecture",
      desc: "Isolated workspaces with granular permissions, custom domains, and modular capabilities per organization.",
      color: "from-purple-500 to-violet-500",
    },
    {
      icon: Bot,
      title: "Autonomous AI Agents",
      desc: "Deploy specialized AI agents with configurable autonomy levels (L0\u2013L5), skills, and governance policies.",
      color: "from-cyan-500 to-teal-500",
    },
    {
      icon: Workflow,
      title: "Workflow Automation",
      desc: "Design complex multi-step workflows with approvals, branching, dead-letter queues, and real-time monitoring.",
      color: "from-emerald-500 to-green-500",
    },
    {
      icon: CreditCard,
      title: "Enterprise Billing",
      desc: "Flexible plans with entitlements, usage metering, and real-time budget controls for every organization.",
      color: "from-pink-500 to-rose-500",
    },
    {
      icon: Plug,
      title: "Integration Marketplace",
      desc: "Connect 50+ tools via a secure adapter pattern. Build custom integrations with our provider SDK.",
      color: "from-amber-500 to-orange-500",
    },
    {
      icon: ShieldCheck,
      title: "Observability & Security",
      desc: "Full audit trails, OpenTelemetry metrics, MFA, policy engine, and SOC2-ready compliance.",
      color: "from-violet-500 to-purple-500",
    },
  ];

  const architectureLayers = [
    {
      title: "AI Agent Runtime",
      icon: Bot,
      borderColor: "border-purple-500/40",
      glowColor: "shadow-[0_0_30px_rgba(168,85,247,0.15)]",
      accentBg: "bg-purple-500/10",
      accentText: "text-purple-400",
      bullets: [
        "L0\u2013L5 autonomy levels with human-in-the-loop controls",
        "Skill registry, tool binding, and context injection",
        "Agent-to-agent communication and delegation protocols",
        "Real-time conversation memory and session management",
      ],
    },
    {
      title: "Workflow Engine + Event Bus",
      icon: Workflow,
      borderColor: "border-cyan-500/40",
      glowColor: "shadow-[0_0_30px_rgba(6,182,212,0.15)]",
      accentBg: "bg-cyan-500/10",
      accentText: "text-cyan-400",
      bullets: [
        "DAG-based workflow orchestration with branching & merging",
        "Approval gates, dead-letter queues, and retry policies",
        "Async event bus with pub/sub and webhook delivery",
        "Real-time workflow monitoring and execution traces",
      ],
    },
    {
      title: "Multi-Tenant Data Platform",
      icon: Layers,
      borderColor: "border-pink-500/40",
      glowColor: "shadow-[0_0_30px_rgba(236,72,153,0.15)]",
      accentBg: "bg-pink-500/10",
      accentText: "text-pink-400",
      bullets: [
        "Isolated org data with row-level security and RBAC",
        "Encrypted storage, audit logging, and data retention policies",
        "Usage metering, quota management, and billing integration",
        "Custom domains, branding, and per-org configuration",
      ],
    },
  ];

  const trustBadges = [
    {
      icon: FileCheck,
      title: "SOC2 Ready",
      desc: "Enterprise-grade compliance framework",
    },
    {
      icon: Shield,
      title: "GDPR Compliant",
      desc: "Full data protection regulation adherence",
    },
    {
      icon: Activity,
      title: "Enterprise SLA",
      desc: "99.9% uptime with dedicated support",
    },
    {
      icon: Headphones,
      title: "24/7 Support",
      desc: "Round-the-clock expert assistance",
    },
  ];

  const testimonials = [
    {
      name: "Sarah Chen",
      role: "CTO",
      company: "TechCorp",
      initials: "SC",
      quote:
        "Mianx.ai delivered our entire MVP in 3 days. What would have taken our team 2 months was done while we slept. Absolutely game-changing.",
    },
    {
      name: "James Rodriguez",
      role: "Founder",
      company: "StartupX",
      initials: "JR",
      quote:
        "I'm not technical at all. I described my app idea in plain English and got a working prototype the same day. It felt like magic.",
    },
    {
      name: "Aisha Patel",
      role: "Product Manager",
      company: "DesignHub",
      initials: "AP",
      quote:
        "The quality of code and design is on par with senior developers. We've shipped 12 projects with Mianx and every client was thrilled.",
    },
  ];

  const faqs = [
    {
      q: "What is Mianx.ai?",
      a: "Mianx.ai is an enterprise-grade Agentic AI Operating Platform that enables organizations to deploy, manage, and govern autonomous AI agents at scale. It provides multi-tenant workspaces, workflow automation, an integration marketplace, and full observability \u2014 all designed for modern teams that need reliable, secure AI infrastructure.",
    },
    {
      q: "How does multi-tenancy work?",
      a: "Each organization gets a fully isolated workspace with its own data, permissions, custom domains, and billing configuration. Role-based access control (RBAC) ensures that only authorized members can access resources. Organizations can modularly enable capabilities, manage their own agent fleet, and customize branding independently.",
    },
    {
      q: "What autonomy levels do agents support?",
      a: "Mianx.ai agents operate on a six-level autonomy scale (L0\u2013L5). L0 requires human approval for every action. L1 can suggest actions. L2 can execute with human review. L3 operates independently within defined guardrails. L4 handles complex multi-step tasks autonomously. L5 is fully autonomous with self-healing capabilities. Organizations can configure the maximum autonomy level per agent and per workflow.",
    },
    {
      q: "Can I integrate with existing tools?",
      a: "Absolutely. Mianx.ai uses a secure adapter pattern that supports 50+ out-of-the-box integrations including Slack, GitHub, Jira, Notion, and more. For custom integrations, our Provider SDK lets you build adapters for any internal tool or third-party service. All integrations run through the platform's event bus for real-time data flow.",
    },
    {
      q: "Is my data secure?",
      a: "Security is foundational to Mianx.ai. All data is encrypted at rest and in transit. We provide full audit trails for every action, OpenTelemetry-based observability, multi-factor authentication (MFA), a configurable policy engine, and are SOC2-ready. Organizations maintain complete data isolation with row-level security and configurable retention policies.",
    },
    {
      q: "How does billing work?",
      a: "Mianx.ai offers flexible enterprise plans with per-organization entitlements. Each plan includes usage metering, real-time budget controls, and transparent cost allocation. Organizations can set spending limits, monitor usage across agents and workflows, and scale their plans as they grow. Contact our sales team for custom enterprise arrangements.",
    },
  ];

  /* ---------- Hero CTA handler ---------- */
  const handlePrimaryCta = () => {
    if (activeOrgId) {
      navigate("dashboard");
    } else if (session?.user) {
      navigate("organizations");
    } else {
      setAuthModal("signup");
    }
  };

  const handleBottomCta = () => {
    if (session?.user) {
      handlePrimaryCta();
    } else {
      setAuthModal("signup");
    }
  };

  return (
    <div className="relative">
      {/* Animated background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div
          className="orb"
          style={{
            top: "-10%",
            left: "10%",
            width: "500px",
            height: "500px",
            background: "rgba(168, 85, 247, 0.3)",
          }}
        />
        <div
          className="orb"
          style={{
            top: "30%",
            right: "5%",
            width: "400px",
            height: "400px",
            background: "rgba(6, 182, 212, 0.25)",
            animationDelay: "5s",
          }}
        />
        <div
          className="orb"
          style={{
            bottom: "10%",
            left: "30%",
            width: "450px",
            height: "450px",
            background: "rgba(236, 72, 153, 0.2)",
            animationDelay: "10s",
          }}
        />
      </div>

      {/* ===== HERO ===== */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 mb-6 text-sm">
              <Sparkles className="h-4 w-4 text-purple-400" />
              <span className="text-muted-foreground">
                Agentic AI Operating Platform
              </span>
            </div>

            <h1 className="mx-auto max-w-5xl text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-tight">
              The AI Operating System{" "}
              <br className="hidden sm:block" />
              for <span className="gradient-text">Modern Teams</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed">
              Deploy autonomous AI agents, automate complex workflows, and govern
              your entire AI infrastructure from a single multi-tenant platform.
              Built for enterprises that demand security, scalability, and control.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <PulsingButton onClick={handlePrimaryCta}>
                {activeOrgId
                  ? "Go to Dashboard"
                  : session?.user
                    ? "My Organizations"
                    : "Start Free Trial"}
                <ArrowRight className="ml-2 h-5 w-5" />
              </PulsingButton>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("services")}
                className="px-8 py-6 text-base glass border-dashed border-muted-foreground/30 text-muted-foreground hover:text-foreground hover:border-solid"
              >
                Explore Platform
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            {/* Floating agent avatars */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="mt-16 flex flex-wrap items-center justify-center gap-3"
            >
              <span className="text-xs text-muted-foreground mr-2">
                Your AI workforce:
              </span>
              {AGENT_CATALOG.slice(0, 12).map((agent, i) => (
                <motion.div
                  key={agent.name}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.5 + i * 0.05, type: "spring" }}
                  title={`${agent.name} \u2014 ${agent.role}`}
                >
                  <AgentAvatar
                    name={agent.name}
                    icon={agent.icon}
                    color={agent.color}
                    size="md"
                  />
                </motion.div>
              ))}
              <span className="text-xs text-muted-foreground ml-2">
                +{Math.max(0, parseInt(platformStats.agentsDeployed, 10) - 12)} more
              </span>
            </motion.div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {stats.map((stat) => (
              <AnimatedStat
                key={stat.label}
                value={stat.value}
                label={stat.label}
                icon={stat.icon}
              />
            ))}
          </motion.div>
        </div>
      </section>

      {/* ===== TRUST BAR ===== */}
      <section className="py-12 px-4 sm:px-6 border-y border-purple-500/10">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-6">
            Trusted by 500+ organizations worldwide
          </p>
          <div className="flex items-center justify-center gap-8 flex-wrap opacity-50">
            {["TechCorp", "StartupX", "DesignHub", "CloudBase", "DataFlow"].map(
              (name) => (
                <div key={name} className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                    {name[0]}
                  </div>
                  <span className="text-sm font-medium">{name}</span>
                </div>
              ),
            )}
          </div>
        </div>
      </section>

      {/* ===== V2 PLATFORM FEATURES ===== */}
      <section className="relative py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold">
              Enterprise-grade{" "}
              <span className="gradient-text">platform capabilities</span>
            </h2>
            <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
              Not another AI wrapper. A complete operating system for deploying,
              managing, and governing autonomous AI at enterprise scale.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <Card className="glass border-purple-500/10 p-6 h-full card-hover">
                  <div
                    className={`inline-flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br ${f.color} mb-4`}
                  >
                    <f.icon className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {f.desc}
                  </p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PLATFORM ARCHITECTURE SHOWCASE ===== */}
      <section className="relative py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold">
              Platform{" "}
              <span className="gradient-text">architecture</span>
            </h2>
            <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
              A layered, modular stack designed for reliability, extensibility,
              and enterprise-grade isolation.
            </p>
          </div>

          <div className="space-y-5">
            {architectureLayers.map((layer, i) => (
              <motion.div
                key={layer.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card
                  className={`glass ${layer.borderColor} p-6 sm:p-8 h-full ${layer.glowColor}`}
                >
                  <div className="flex items-center gap-3 mb-5">
                    <div
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${layer.accentBg}`}
                    >
                      <layer.icon className={`h-5 w-5 ${layer.accentText}`} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">{layer.title}</h3>
                      <p className={`text-xs ${layer.accentText} font-medium`}>
                        Layer {i + 1}
                      </p>
                    </div>
                  </div>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {layer.bullets.map((bullet, j) => (
                      <li
                        key={j}
                        className="flex items-start gap-2.5 text-sm text-muted-foreground"
                      >
                        <CheckCircle2
                          className={`h-4 w-4 mt-0.5 flex-shrink-0 ${layer.accentText}`}
                        />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Connecting line between layers */}
          <div className="hidden lg:flex justify-center py-2">
            <div className="flex flex-col items-center gap-0">
              <div className="w-px h-4 bg-gradient-to-b from-purple-500/50 to-cyan-500/50" />
              <div className="w-px h-4 bg-gradient-to-b from-cyan-500/50 to-pink-500/50" />
            </div>
          </div>
        </div>
      </section>

      {/* ===== AGENT TEAMS PREVIEW ===== */}
      <section className="relative py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 mb-4 text-xs">
              <Bot className="h-3.5 w-3.5 text-purple-400" />
              <span className="text-muted-foreground">
                {platformStats.teamsCount} specialized teams \u00b7{" "}
                {platformStats.agentsDeployed}+ deployable agents
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold">
              {t("agents.title")}
            </h2>
            <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
              {t("agents.subtitle")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {teams.map((teamKey, i) => {
              const team = TEAM_INFO[teamKey];
              const teamAgents = AGENT_CATALOG.filter(
                (a) => a.team === teamKey,
              );
              return (
                <motion.div
                  key={teamKey}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                >
                  <Card
                    className="glass border-purple-500/10 p-6 h-full card-hover cursor-pointer"
                    onClick={() => navigate("agents")}
                  >
                    <div
                      className={`inline-flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br ${team.color} mb-4`}
                    >
                      <AgentAvatar
                        name={team.label}
                        icon={team.icon}
                        color={team.color}
                        size="sm"
                      />
                    </div>
                    <h3 className="text-lg font-semibold mb-1">
                      {team.label}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {team.description}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {teamAgents.map((a) => (
                        <span
                          key={a.name}
                          className="text-xs px-2 py-0.5 rounded-md glass"
                        >
                          {a.name}
                        </span>
                      ))}
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          <div className="text-center mt-8">
            <Button
              variant="outline"
              onClick={() => navigate("agents")}
              className="glass"
            >
              {t("common.viewAll")} agents
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* ===== ENTERPRISE TRUST ===== */}
      <section className="relative py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 mb-4 text-xs">
              <ShieldCheck className="h-3.5 w-3.5 text-purple-400" />
              <span className="text-muted-foreground">
                Enterprise-grade trust & compliance
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold">
              Built for{" "}
              <span className="gradient-text">enterprise trust</span>
            </h2>
            <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
              Security, compliance, and reliability are not afterthoughts \u2014
              they're baked into every layer of the platform.
            </p>
          </div>

          {/* Trust badges row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
            {trustBadges.map((badge, i) => (
              <motion.div
                key={badge.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <Card className="glass border-purple-500/10 p-5 text-center card-hover h-full">
                  <badge.icon className="mx-auto h-7 w-7 text-purple-400 mb-3" />
                  <h3 className="text-sm font-semibold mb-1">{badge.title}</h3>
                  <p className="text-xs text-muted-foreground">{badge.desc}</p>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Testimonials */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {testimonials.map((tm, i) => (
              <motion.div
                key={tm.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="glass border-purple-500/10 p-6 h-full card-hover flex flex-col">
                  <Quote className="h-8 w-8 text-purple-500/30 mb-4" />
                  <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                    &ldquo;{tm.quote}&rdquo;
                  </p>
                  <div className="mt-6 pt-4 border-t border-purple-500/10">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-xs font-bold text-white">
                        {tm.initials}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{tm.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {tm.role} at {tm.company}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-0.5 mt-2">
                      {[...Array(5)].map((_, s) => (
                        <Star
                          key={s}
                          className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
                        />
                      ))}
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="relative py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 mb-4 text-xs">
              <HelpCircle className="h-3.5 w-3.5 text-purple-400" />
              <span className="text-muted-foreground">Got questions?</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold">
              Frequently asked{" "}
              <span className="gradient-text">questions</span>
            </h2>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, i) => (
                <AccordionItem
                  key={i}
                  value={`faq-${i}`}
                  className="glass border-purple-500/10 rounded-lg px-5 mb-2"
                >
                  <AccordionTrigger className="text-left text-sm sm:text-base font-medium hover:no-underline">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </div>
      </section>

      {/* ===== BOTTOM CTA ===== */}
      <section className="relative py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <Card className="glass-strong border-purple-500/20 p-10 sm:p-16 text-center relative overflow-hidden">
            <div className="absolute inset-0 grid-pattern opacity-30" />
            <div className="relative">
              <Sparkles className="mx-auto h-10 w-10 text-purple-400 mb-4" />
              <h2 className="text-3xl sm:text-4xl font-bold mb-3">
                Ready to deploy your{" "}
                <span className="gradient-text">AI workforce?</span>
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto mb-8">
                Join 500+ organizations already running autonomous AI agents on
                Mianx.ai. Start your free trial today \u2014 no credit card required.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <PulsingButton onClick={handleBottomCta}>
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </PulsingButton>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => navigate("pricing")}
                  className="px-8 py-6 text-base glass border-dashed border-muted-foreground/30 text-muted-foreground hover:text-foreground hover:border-solid"
                >
                  View Pricing
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
