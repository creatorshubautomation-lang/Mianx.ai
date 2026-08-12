"use client";

import { useApp } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import {
  Target,
  Eye,
  Heart,
  Users,
  Rocket,
  Globe,
  Sparkles,
  ArrowRight,
  Code2,
  Bot,
} from "lucide-react";

export function AboutView() {
  const { setView, setAuthModal } = useApp();

  const values = [
    {
      icon: Target,
      title: "Mission-Driven",
      desc: "We exist to democratize software development. Every business, regardless of size or budget, deserves world-class execution.",
    },
    {
      icon: Eye,
      title: "Radical Transparency",
      desc: "You see exactly what your agents are doing, when, and why. No black boxes, no hidden processes, no surprises.",
    },
    {
      icon: Heart,
      title: "Quality First",
      desc: "Every deliverable is reviewed by our QA agents before it reaches you. If it's not production-ready, it doesn't ship.",
    },
    {
      icon: Users,
      title: "Built for Teams",
      desc: "From solo founders to enterprise teams, Mianx.ai scales with you. Collaboration, roles, and permissions built-in.",
    },
  ];

  const milestones = [
    { year: "2025", title: "The Idea", desc: "Founded on a simple insight: AI agents can do real software work, not just chat." },
    { year: "Q1 2026", title: "First 24 Agents", desc: "Built and deployed our initial 6-team, 24-agent catalog covering the full SDLC." },
    { year: "Q2 2026", title: "1,000 Projects", desc: "Crossed 1,000 delivered projects with 98% client satisfaction rate." },
    { year: "Q3 2026", title: "Multi-Language", desc: "Launched English, Urdu, and Roman Urdu support for global and regional clients." },
    { year: "Q4 2026", title: "Enterprise Ready", desc: "SSO, SLAs, dedicated agents, and on-premise options for large organizations." },
  ];

  const tech = [
    "Next.js 16", "TypeScript", "Prisma", "Tailwind CSS 4", "shadcn/ui",
    "NextAuth", "Zustand", "TanStack Query", "Framer Motion", "Recharts",
    "OpenAI GPT", "Anthropic Claude", "z-ai-web-dev-sdk", "Vercel", "SQLite",
  ];

  return (
    <div className="relative min-h-screen pt-24 pb-20">
      <div className="fixed inset-0 mesh-bg-soft -z-10" />

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Hero */}
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 mb-4 text-xs"
          >
            <Sparkles className="h-3.5 w-3.5 text-purple-400" />
            <span className="text-muted-foreground">Our story</span>
          </motion.div>
          <h1 className="text-4xl sm:text-6xl font-bold mb-6">
            We&apos;re building the{" "}
            <span className="gradient-text">future of software</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Mianx.ai was founded on a simple belief: the best software houses shouldn&apos;t be limited by human bandwidth. By building teams of specialized AI agents, we deliver faster, cheaper, and often better than traditional agencies — without the overhead, ego, or office politics.
          </p>
        </div>

        {/* Stats banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          {[
            { label: "Founded", value: "2025", icon: Rocket },
            { label: "AI Agents", value: "24", icon: Bot },
            { label: "Projects Shipped", value: "1,200+", icon: Code2 },
            { label: "Countries", value: "40+", icon: Globe },
          ].map((s) => (
            <Card key={s.label} className="glass border-purple-500/10 p-5 text-center">
              <s.icon className="mx-auto h-5 w-5 text-purple-400 mb-2" />
              <div className="text-2xl font-bold gradient-text">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </Card>
          ))}
        </div>

        {/* Values */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8">
            What we <span className="gradient-text">believe</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {values.map((v, i) => (
              <motion.div
                key={v.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <Card className="glass border-purple-500/10 p-6 h-full card-hover">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500">
                      <v.icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-1">{v.title}</h3>
                      <p className="text-sm text-muted-foreground">{v.desc}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8">
            Our <span className="gradient-text">journey</span>
          </h2>
          <div className="relative">
            <div className="absolute left-4 sm:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-purple-500/50 to-transparent sm:-translate-x-1/2" />
            <div className="space-y-6">
              {milestones.map((m, i) => (
                <motion.div
                  key={m.year}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className={`relative flex items-start gap-6 ${
                    i % 2 === 0 ? "sm:flex-row" : "sm:flex-row-reverse"
                  }`}
                >
                  <div className="flex-shrink-0 ml-4 sm:ml-0 sm:w-1/2 sm:px-6">
                    <Card className="glass border-purple-500/10 p-5">
                      <Badge className="mb-2 bg-gradient-to-r from-purple-500 to-cyan-500">
                        {m.year}
                      </Badge>
                      <h3 className="font-semibold mb-1">{m.title}</h3>
                      <p className="text-sm text-muted-foreground">{m.desc}</p>
                    </Card>
                  </div>
                  <div className="absolute left-4 sm:left-1/2 top-5 -translate-x-1/2 h-3 w-3 rounded-full bg-purple-500 glow-sm" />
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Tech stack */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8">
            Built with <span className="gradient-text">modern tech</span>
          </h2>
          <Card className="glass border-purple-500/10 p-8">
            <div className="flex flex-wrap gap-2 justify-center">
              {tech.map((name) => (
                <span
                  key={name}
                  className="px-3 py-1.5 rounded-md glass text-sm hover:bg-purple-500/20 transition-colors"
                >
                  {name}
                </span>
              ))}
            </div>
          </Card>
        </div>

        {/* CTA */}
        <Card className="glass-strong border-purple-500/20 p-10 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">
            Join the agentic revolution
          </h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Be part of the first wave of teams building software with AI agents. Your competitors already are.
          </p>
          <Button
            size="lg"
            onClick={() => setAuthModal("signup")}
            className="btn-gradient text-white"
          >
            Get Started Free
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Card>
      </div>
    </div>
  );
}
