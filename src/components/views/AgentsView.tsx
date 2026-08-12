"use client";

import { useState } from "react";
import { useApp, useT } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AgentAvatar } from "../mianx/AgentAvatar";
import {
  AGENT_CATALOG,
  TEAM_INFO,
  type AgentTeamType,
} from "@/lib/agents";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowRight, CheckCircle2, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";

export function AgentsView() {
  const t = useT();
  const { setView, setAuthModal } = useApp();
  const [selected, setSelected] = useState<string | null>(null);

  const teams = Object.keys(TEAM_INFO) as AgentTeamType[];
  const selectedAgent = AGENT_CATALOG.find((a) => a.name === selected);

  return (
    <div className="relative min-h-screen pt-24 pb-20">
      <div className="fixed inset-0 mesh-bg-soft -z-10" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 mb-4 text-xs">
            <span className="text-muted-foreground">24 agents · 6 teams</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold">
            {t("agents.title")}
          </h1>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            {t("agents.subtitle")}
          </p>
        </div>

        {/* Teams */}
        {teams.map((teamKey) => {
          const team = TEAM_INFO[teamKey];
          const agents = AGENT_CATALOG.filter((a) => a.team === teamKey);

          return (
            <div key={teamKey} className="mb-16">
              <div className="flex items-center gap-3 mb-6">
                <AgentAvatar
                  name={team.label}
                  icon={team.icon}
                  color={team.color}
                  size="lg"
                />
                <div>
                  <h2 className="text-2xl font-bold">{team.label}</h2>
                  <p className="text-sm text-muted-foreground">
                    {team.description}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {agents.map((agent, i) => (
                  <motion.div
                    key={agent.name}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card
                      className="glass border-purple-500/10 p-5 h-full card-hover cursor-pointer"
                      onClick={() => setSelected(agent.name)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <AgentAvatar
                          name={agent.name}
                          icon={agent.icon}
                          color={agent.color}
                          size="lg"
                          status="working"
                        />
                        <Badge
                          variant="outline"
                          className="text-xs glass"
                        >
                          {agent.team.toLowerCase()}
                        </Badge>
                      </div>
                      <h3 className="font-semibold text-lg">{agent.name}</h3>
                      <p className="text-xs text-purple-300 mb-2">
                        {agent.role}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {agent.description}
                      </p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {agent.capabilities.length} skills
                        </span>
                        <span className="text-xs text-purple-300 flex items-center gap-1">
                          Profile <ArrowRight className="h-3 w-3" />
                        </span>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          );
        })}

        {/* CTA */}
        <Card className="glass-strong border-purple-500/20 p-10 text-center mt-12">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">
            Ready to put these agents to work?
          </h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Create a project and the right agents from these teams will be auto-assigned to deliver it.
          </p>
          <Button
            size="lg"
            onClick={() => setAuthModal("signup")}
            className="btn-gradient text-white"
          >
            Start Your Project
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Card>
      </div>

      {/* Agent detail modal */}
      <Dialog
        open={selectedAgent !== undefined}
        onOpenChange={() => setSelected(null)}
      >
        <DialogContent className="sm:max-w-lg glass-strong border-purple-500/20 max-h-[85vh] overflow-y-auto">
          {selectedAgent && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-4">
                  <AgentAvatar
                    name={selectedAgent.name}
                    icon={selectedAgent.icon}
                    color={selectedAgent.color}
                    size="xl"
                    status="working"
                  />
                  <div>
                    <DialogTitle className="text-2xl">
                      {selectedAgent.name}
                    </DialogTitle>
                    <p className="text-sm text-purple-300">
                      {selectedAgent.role}
                    </p>
                    <Badge variant="outline" className="mt-1 text-xs glass">
                      {TEAM_INFO[selectedAgent.team].label}
                    </Badge>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                <div>
                  <h4 className="text-sm font-semibold mb-1">About</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedAgent.description}
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">
                    {t("agents.capabilities")}
                  </h4>
                  <div className="space-y-1.5">
                    {selectedAgent.capabilities.map((c) => (
                      <div
                        key={c}
                        className="flex items-center gap-2 text-sm"
                      >
                        <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0" />
                        <span className="text-muted-foreground">{c}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-purple-500/10">
                  <Button
                    onClick={() => {
                      setSelected(null);
                      setAuthModal("signup");
                    }}
                    className="w-full btn-gradient text-white"
                  >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Work with {selectedAgent.name}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
