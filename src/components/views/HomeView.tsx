"use client";

import { useApp, useT } from "@/lib/store";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AgentAvatar } from "../mianx/AgentAvatar";
import { AGENT_CATALOG, TEAM_INFO, type AgentTeamType } from "@/lib/agents";
import { getPlatformStats } from "@/lib/platform-stats";
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
} from "lucide-react";
import { motion } from "framer-motion";

export function HomeView() {
  const t = useT();
  const { navigate, setAuthModal } = useApp();
  const { data: session } = useSession();

  const teams = Object.keys(TEAM_INFO) as AgentTeamType[];

  const platformStats = getPlatformStats();

  const stats = [
    { value: platformStats.totalProjects, label: t("hero.stat.projects"), icon: Rocket },
    { value: platformStats.agentsDeployed, label: t("hero.stat.agents"), icon: Bot },
    { value: platformStats.uptime, label: t("hero.stat.uptime"), icon: Clock },
    { value: platformStats.clientSatisfaction, label: t("hero.stat.satisfaction"), icon: CheckCircle2 },
  ];

  const features = [
    {
      icon: Workflow,
      title: "Autonomous Agent Teams",
      desc: "Each project gets a dedicated team of 3-8 AI agents that plan, build, review, and deliver — without human bottlenecks.",
      color: "from-purple-500 to-violet-500",
    },
    {
      icon: Cpu,
      title: "Real AI, Not Templates",
      desc: "Every line of code, every word of copy, every design decision — generated fresh by our specialized LLM agents for your specific brief.",
      color: "from-cyan-500 to-blue-500",
    },
    {
      icon: Shield,
      title: "QA Built-In",
      desc: "Dedicated QA agents review every deliverable — code is tested, security is audited, performance is profiled before it reaches you.",
      color: "from-emerald-500 to-green-500",
    },
    {
      icon: Globe,
      title: "24/7 Multi-Language",
      desc: "Agents work around the clock and communicate in English, Urdu, or Roman Urdu — whatever you prefer.",
      color: "from-pink-500 to-rose-500",
    },
    {
      icon: Zap,
      title: "Lightning Fast",
      desc: "From brief to first deliverable in under 10 minutes. What took weeks now takes hours — without sacrificing quality.",
      color: "from-amber-500 to-orange-500",
    },
    {
      icon: Clock,
      title: "Always Available",
      desc: "Your agent team never sleeps, never gets sick, never goes on vacation. They're ready whenever you have an idea.",
      color: "from-violet-500 to-purple-500",
    },
  ];

  const workflow = [
    {
      step: "01",
      title: "Submit Your Brief",
      desc: "Describe your project — what you're building, who it's for, what success looks like. No technical jargon required.",
    },
    {
      step: "02",
      title: "AI Analyzes & Assigns",
      desc: "Our system reads your brief and assembles the perfect agent team — designer, developer, content writer, whoever's needed.",
    },
    {
      step: "03",
      title: "Agents Start Working",
      desc: "Your team gets to work immediately — planning, building, reviewing. You watch progress in real-time via the dashboard.",
    },
    {
      step: "04",
      title: "Chat & Iterate",
      desc: "Message any agent directly. Ask questions, request changes, provide feedback. They respond and adjust instantly.",
    },
    {
      step: "05",
      title: "Receive Deliverables",
      desc: "Download production-ready code, finalized designs, polished copy — all quality-checked by our QA agents.",
    },
  ];

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

      {/* HERO */}
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
              <span className="text-muted-foreground">{t("hero.badge")}</span>
            </div>

            <h1 className="mx-auto max-w-4xl text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-tight">
              {t("hero.title").split("AI agents").map((part, i) =>
                i === 0 ? (
                  part
                ) : (
                  <span key={i} className="gradient-text">
                    AI agents
                    {part}
                  </span>
                ),
              )}
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed">
              {t("hero.subtitle")}
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                size="lg"
                onClick={() => {
                  if (session?.user) {
                    navigate("newProject");
                  } else {
                    setAuthModal("signup");
                  }
                }}
                className="btn-gradient text-white px-8 py-6 text-base glow-sm"
              >
                {session?.user ? "Start New Project" : t("hero.cta.primary")}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("agents")}
                className="px-8 py-6 text-base glass"
              >
                {t("hero.cta.secondary")}
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
                Your team:
              </span>
              {AGENT_CATALOG.slice(0, 12).map((agent, i) => (
                <motion.div
                  key={agent.name}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.5 + i * 0.05, type: "spring" }}
                  title={`${agent.name} — ${agent.role}`}
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
                +12 more
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
              <Card
                key={stat.label}
                className="glass border-purple-500/10 p-6 text-center card-hover"
              >
                <stat.icon className="mx-auto h-6 w-6 text-purple-400 mb-2" />
                <div className="text-2xl sm:text-3xl font-bold gradient-text">
                  {stat.value}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {stat.label}
                </div>
              </Card>
            ))}
          </motion.div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="relative py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold">
              Why teams choose{" "}
              <span className="gradient-text">Mianx.ai</span>
            </h2>
            <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
              Not another AI wrapper. A full software house — autonomous, specialized, accountable.
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

      {/* AGENT TEAMS PREVIEW */}
      <section className="relative py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 mb-4 text-xs">
              <Bot className="h-3.5 w-3.5 text-purple-400" />
              <span className="text-muted-foreground">{platformStats.teamsCount} teams · {platformStats.agentsDeployed} agents</span>
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
                    <h3 className="text-lg font-semibold mb-1">{team.label}</h3>
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

      {/* WORKFLOW */}
      <section className="relative py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold">
              From brief to{" "}
              <span className="gradient-text">deliverable</span> in 5 steps
            </h2>
            <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
              No meetings. No back-and-forth. No missed deadlines. Just describe what you want and watch it get built.
            </p>
          </div>

          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-4 sm:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-purple-500/50 via-cyan-500/30 to-transparent sm:-translate-x-1/2" />

            <div className="space-y-8">
              {workflow.map((w, i) => (
                <motion.div
                  key={w.step}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className={`relative flex items-start gap-6 ${
                    i % 2 === 0 ? "sm:flex-row" : "sm:flex-row-reverse"
                  }`}
                >
                  <div className="flex-shrink-0 ml-4 sm:ml-0 sm:w-1/2 sm:px-8">
                    <Card className="glass border-purple-500/10 p-6 card-hover">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl font-bold gradient-text">
                          {w.step}
                        </span>
                        <h3 className="text-lg font-semibold">{w.title}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">{w.desc}</p>
                    </Card>
                  </div>
                  <div className="absolute left-4 sm:left-1/2 top-6 -translate-x-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 glow-sm">
                    <span className="text-xs font-bold text-white">{i + 1}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <Card className="glass-strong border-purple-500/20 p-10 sm:p-16 text-center relative overflow-hidden">
            <div className="absolute inset-0 grid-pattern opacity-30" />
            <div className="relative">
              <Sparkles className="mx-auto h-10 w-10 text-purple-400 mb-4" />
              <h2 className="text-3xl sm:text-4xl font-bold mb-3">
                Ready to build with{" "}
                <span className="gradient-text">AI agents?</span>
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto mb-6">
                Join {platformStats.totalProjectsLabel} teams who ship faster with Mianx.ai. Your first project is on us — no credit card required.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  size="lg"
                  onClick={() => {
                    if (session?.user) {
                      navigate("newProject");
                    } else {
                      setAuthModal("signup");
                    }
                  }}
                  className="btn-gradient text-white px-8 py-6 text-base"
                >
                  {session?.user ? "Start New Project" : t("hero.cta.primary")}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => navigate("pricing")}
                  className="px-8 py-6 text-base glass"
                >
                  {t("nav.pricing")}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
