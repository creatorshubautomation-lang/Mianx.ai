"use client";

import { useApp, useT } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AgentAvatar } from "../mianx/AgentAvatar";
import { TEAM_INFO, type AgentTeamType, AGENT_CATALOG } from "@/lib/agents";
import {
  Palette,
  Code2,
  PenLine,
  TrendingUp,
  ShieldCheck,
  MessageCircle,
  ArrowRight,
  Check,
} from "lucide-react";
import { motion } from "framer-motion";

export function ServicesView() {
  const t = useT();
  const { setView, setAuthModal } = useApp();

  const services: {
    team: AgentTeamType;
    icon: typeof Palette;
    titleKey: string;
    descKey: string;
    deliverables: string[];
  }[] = [
    {
      team: "DESIGN",
      icon: Palette,
      titleKey: "services.design.title",
      descKey: "services.design.desc",
      deliverables: [
        "Brand identity systems",
        "UI/UX design (Figma-style)",
        "Logo & visual assets",
        "Design system documentation",
      ],
    },
    {
      team: "DEVELOPMENT",
      icon: Code2,
      titleKey: "services.dev.title",
      descKey: "services.dev.desc",
      deliverables: [
        "Production-ready React/Next.js code",
        "Backend APIs & databases",
        "DevOps pipelines",
        "Database schema design",
      ],
    },
    {
      team: "CONTENT",
      icon: PenLine,
      titleKey: "services.content.title",
      descKey: "services.content.desc",
      deliverables: [
        "Marketing copy & taglines",
        "SEO-optimized blog posts",
        "Video & podcast scripts",
        "Brand voice guidelines",
      ],
    },
    {
      team: "MARKETING",
      icon: TrendingUp,
      titleKey: "services.marketing.title",
      descKey: "services.marketing.desc",
      deliverables: [
        "SEO audits & strategy",
        "Social media calendars",
        "Ad copy (Google/Meta)",
        "Analytics dashboard setup",
      ],
    },
    {
      team: "QA",
      icon: ShieldCheck,
      titleKey: "services.qa.title",
      descKey: "services.qa.desc",
      deliverables: [
        "Automated test suites",
        "Code review reports",
        "Security audit findings",
        "Performance optimization plans",
      ],
    },
    {
      team: "SUPPORT",
      icon: MessageCircle,
      titleKey: "services.support.title",
      descKey: "services.support.desc",
      deliverables: [
        "24/7 chat support coverage",
        "Email response templates",
        "Ticket triage workflows",
        "Customer feedback reports",
      ],
    },
  ];

  return (
    <div className="relative min-h-screen pt-24 pb-20">
      <div className="fixed inset-0 mesh-bg-soft -z-10" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold">
            {t("services.title")}
          </h1>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            {t("services.subtitle")}
          </p>
        </div>

        {/* Services grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {services.map((s, i) => {
            const team = TEAM_INFO[s.team];
            const teamAgents = AGENT_CATALOG.filter((a) => a.team === s.team);
            return (
              <motion.div
                key={s.team}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <Card className="glass border-purple-500/10 p-7 h-full card-hover">
                  <div className="flex items-start gap-4 mb-4">
                    <div
                      className={`flex-shrink-0 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br ${team.color}`}
                    >
                      <s.icon className="h-7 w-7 text-white" />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-xl font-bold">{t(s.titleKey)}</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        {t(s.descKey)}
                      </p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Deliverables
                    </h4>
                    <ul className="space-y-1.5">
                      {s.deliverables.map((d) => (
                        <li
                          key={d}
                          className="flex items-start gap-2 text-sm"
                        >
                          <Check className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-3 border-t border-purple-500/10">
                    {teamAgents.map((a) => (
                      <div key={a.name} className="flex items-center gap-1.5">
                        <AgentAvatar
                          name={a.name}
                          icon={a.icon}
                          color={a.color}
                          size="sm"
                        />
                        <span className="text-xs text-muted-foreground">
                          {a.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* CTA */}
        <Card className="glass-strong border-purple-500/20 p-10 text-center mt-12">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">
            One subscription.{" "}
            <span className="gradient-text">All six teams.</span>
          </h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Don&apos;t pick and choose. Every Mianx.ai plan gives you access to all 24 agents across all 6 teams.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="lg"
              onClick={() => setAuthModal("signup")}
              className="btn-gradient text-white"
            >
              {t("hero.cta.primary")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => setView("pricing")}
              className="glass"
            >
              {t("nav.pricing")}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
