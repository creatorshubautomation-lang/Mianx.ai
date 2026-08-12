"use client";

import { useState } from "react";
import { useApp, useT } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AgentAvatar } from "../mianx/AgentAvatar";
import {
  Globe,
  Smartphone,
  Palette,
  FileText,
  TrendingUp,
  Layers,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  Sparkles,
  Bot,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface AnalysisResult {
  recommendedAgents: string[];
  estimatedTimeline: string;
  suggestedTasks: { title: string; description: string; agent: string }[];
  summary: string;
}

const PROJECT_TYPES = [
  { key: "web", icon: Globe, label: "Web Application", desc: "Websites, dashboards, web apps" },
  { key: "mobile", icon: Smartphone, label: "Mobile App", desc: "iOS, Android, cross-platform" },
  { key: "branding", icon: Palette, label: "Branding & Design", desc: "Brand identity, UI/UX, visuals" },
  { key: "content", icon: FileText, label: "Content Creation", desc: "Copy, blogs, scripts, SEO" },
  { key: "marketing", icon: TrendingUp, label: "Marketing Campaign", desc: "SEO, social, ads, growth" },
  { key: "fullstack", icon: Layers, label: "Full Software Suite", desc: "Complete product from A to Z" },
];

const PRIORITIES = [
  { key: "low", label: "Low", color: "bg-gray-500" },
  { key: "normal", label: "Normal", color: "bg-blue-500" },
  { key: "high", label: "High", color: "bg-amber-500" },
  { key: "urgent", label: "Urgent", color: "bg-red-500" },
];

export function NewProjectWizard() {
  const t = useT();
  const { setView, setSelectedProject } = useApp();
  const [step, setStep] = useState(1);
  const [analyzing, setAnalyzing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  const [form, setForm] = useState({
    projectType: "",
    title: "",
    description: "",
    budget: "",
    deadline: "",
    priority: "normal",
  });

  const canProceed = () => {
    if (step === 1) return !!form.projectType;
    if (step === 2) return form.title.length > 3 && form.description.length > 20;
    return true;
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          projectType: form.projectType,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setAnalysis(data.analysis);
        setStep(3);
      } else {
        toast.error(data.error || "Analysis failed");
      }
    } catch {
      toast.error("Failed to analyze brief");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          projectType: form.projectType,
          requirements: {},
          priority: form.priority,
          budget: form.budget,
          deadline: form.deadline,
          recommendedAgents: analysis?.recommendedAgents || [],
          suggestedTasks: analysis?.suggestedTasks || [],
        }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success("Project created! Agents are starting work...");
        setSelectedProject(data.project.id);
        setView("projectDetail");
      } else {
        toast.error(data.error || "Failed to create project");
      }
    } catch {
      toast.error("Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setView("dashboard")}
          className="mb-3 text-xs"
        >
          <ArrowLeft className="mr-1 h-3 w-3" />
          Back to Dashboard
        </Button>
        <h1 className="text-2xl sm:text-3xl font-bold">{t("wizard.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tell us what you need. AI will assemble the right agent team.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3, 4].map((s, i) => (
          <div key={s} className="flex items-center flex-1 last:flex-none">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-all ${
                step >= s
                  ? "bg-gradient-to-br from-purple-500 to-cyan-500 text-white"
                  : "glass text-muted-foreground"
              }`}
            >
              {step > s ? <Check className="h-4 w-4" /> : s}
            </div>
            {i < 3 && (
              <div
                className={`h-0.5 flex-1 mx-2 rounded-full transition-all ${
                  step > s ? "bg-purple-500" : "bg-border"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Steps */}
      <motion.div
        key={step}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
      >
        {step === 1 && (
          <Card className="glass border-purple-500/10 p-6">
            <h2 className="text-lg font-semibold mb-1">{t("wizard.projectType")}</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Pick the category that best fits what you&apos;re building.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PROJECT_TYPES.map((pt) => (
                <button
                  key={pt.key}
                  onClick={() => setForm({ ...form, projectType: pt.key })}
                  className={`flex items-start gap-3 p-4 rounded-lg border text-left transition-all ${
                    form.projectType === pt.key
                      ? "border-purple-500/40 bg-purple-500/10 glow-sm"
                      : "border-purple-500/10 glass hover:border-purple-500/30"
                  }`}
                >
                  <div
                    className={`flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-lg ${
                      form.projectType === pt.key
                        ? "bg-gradient-to-br from-purple-500 to-cyan-500"
                        : "bg-purple-500/10"
                    }`}
                  >
                    <pt.icon
                      className={`h-5 w-5 ${
                        form.projectType === pt.key
                          ? "text-white"
                          : "text-purple-300"
                      }`}
                    />
                  </div>
                  <div>
                    <div className="font-medium text-sm">{pt.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {pt.desc}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        )}

        {step === 2 && (
          <Card className="glass border-purple-500/10 p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold mb-1">Project details</h2>
              <p className="text-sm text-muted-foreground">
                The more detail you give, the better your agents can plan.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">{t("wizard.title.label")}</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={t("wizard.title.placeholder")}
                className="glass"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t("wizard.description.label")}</Label>
              <Textarea
                id="description"
                rows={5}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder={t("wizard.description.placeholder")}
                className="glass resize-none"
              />
              <p className="text-xs text-muted-foreground">
                {form.description.length} characters · minimum 20 required
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="budget">{t("wizard.budget.label")}</Label>
                <Input
                  id="budget"
                  type="number"
                  value={form.budget}
                  onChange={(e) =>
                    setForm({ ...form, budget: e.target.value })
                  }
                  placeholder="5000"
                  className="glass"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deadline">{t("wizard.deadline.label")}</Label>
                <Input
                  id="deadline"
                  type="date"
                  value={form.deadline}
                  onChange={(e) =>
                    setForm({ ...form, deadline: e.target.value })
                  }
                  className="glass"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("wizard.priority.label")}</Label>
              <div className="grid grid-cols-4 gap-2">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setForm({ ...form, priority: p.key })}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-all border ${
                      form.priority === p.key
                        ? "border-purple-500/40 bg-purple-500/10"
                        : "border-purple-500/10 glass hover:border-purple-500/30"
                    }`}
                  >
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${p.color} mr-2`}
                    />
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        )}

        {step === 3 && (
          <Card className="glass border-purple-500/10 p-6">
            {analyzing ? (
              <div className="py-12 text-center">
                <div className="mx-auto h-16 w-16 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center mb-4 glow">
                  <Bot className="h-8 w-8 text-white animate-pulse" />
                </div>
                <h3 className="font-semibold text-lg mb-2">
                  {t("wizard.analyzing")}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Reading your brief, identifying the right specialists, planning the work...
                </p>
                <div className="flex justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
                </div>
              </div>
            ) : analysis ? (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-5 w-5 text-purple-400" />
                  <h2 className="text-lg font-semibold">
                    {t("wizard.assigned")}
                  </h2>
                </div>
                <p className="text-sm text-muted-foreground mb-5">
                  {t("wizard.assigned.desc")}
                </p>

                {/* Summary */}
                <div className="glass rounded-lg p-4 mb-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-cyan-400" />
                    <span className="text-sm font-medium">
                      Estimated Timeline:
                    </span>
                    <Badge variant="outline" className="glass">
                      {analysis.estimatedTimeline}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {analysis.summary}
                  </p>
                </div>

                {/* Recommended agents */}
                <h3 className="text-sm font-semibold mb-3">
                  Recommended Agent Team
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
                  {analysis.recommendedAgents.map((name) => {
                    // Get agent from catalog
                    const agent = getAgentByName(name);
                    if (!agent) return null;
                    return (
                      <div
                        key={name}
                        className="glass rounded-lg p-3 flex items-center gap-3"
                      >
                        <AgentAvatar
                          name={agent.name}
                          icon={agent.icon}
                          color={agent.color}
                          size="md"
                          status="assigned"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">
                            {agent.name}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {agent.role}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Suggested tasks */}
                {analysis.suggestedTasks?.length > 0 && (
                  <>
                    <h3 className="text-sm font-semibold mb-3">
                      Planned Tasks
                    </h3>
                    <div className="space-y-2 mb-5">
                      {analysis.suggestedTasks.slice(0, 6).map((task, i) => (
                        <div
                          key={i}
                          className="glass rounded-lg p-3 flex items-start gap-3"
                        >
                          <div className="flex-shrink-0 h-6 w-6 rounded-full bg-purple-500/20 flex items-center justify-center text-xs font-medium text-purple-300">
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">
                              {task.title}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {task.description}
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className="text-xs glass flex-shrink-0"
                          >
                            {task.agent}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </Card>
        )}

        {step === 4 && (
          <Card className="glass border-purple-500/10 p-6">
            <h2 className="text-lg font-semibold mb-1">Review & create</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Double-check everything looks right. Agents start working the moment you create.
            </p>

            <div className="space-y-3">
              <div className="glass rounded-lg p-4">
                <div className="text-xs text-muted-foreground mb-1">Type</div>
                <div className="font-medium capitalize">
                  {PROJECT_TYPES.find((p) => p.key === form.projectType)?.label}
                </div>
              </div>
              <div className="glass rounded-lg p-4">
                <div className="text-xs text-muted-foreground mb-1">Title</div>
                <div className="font-medium">{form.title}</div>
              </div>
              <div className="glass rounded-lg p-4">
                <div className="text-xs text-muted-foreground mb-1">
                  Description
                </div>
                <div className="text-sm">{form.description}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="glass rounded-lg p-4">
                  <div className="text-xs text-muted-foreground mb-1">
                    Priority
                  </div>
                  <div className="font-medium capitalize">
                    {form.priority}
                  </div>
                </div>
                <div className="glass rounded-lg p-4">
                  <div className="text-xs text-muted-foreground mb-1">
                    Timeline
                  </div>
                  <div className="font-medium">
                    {analysis?.estimatedTimeline || "—"}
                  </div>
                </div>
              </div>
              <div className="glass rounded-lg p-4">
                <div className="text-xs text-muted-foreground mb-2">
                  Agent Team ({analysis?.recommendedAgents.length || 0}{" "}
                  agents)
                </div>
                <div className="flex flex-wrap gap-2">
                  {analysis?.recommendedAgents.map((name) => {
                    const agent = getAgentByName(name);
                    if (!agent) return null;
                    return (
                      <AgentAvatar
                        key={name}
                        name={agent.name}
                        icon={agent.icon}
                        color={agent.color}
                        size="md"
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>
        )}
      </motion.div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <Button
          variant="ghost"
          onClick={() => (step > 1 ? setStep(step - 1) : setView("dashboard"))}
          disabled={analyzing || creating}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("wizard.back")}
        </Button>

        {step < 2 && (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
            className="btn-gradient text-white"
          >
            {t("wizard.next")}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}

        {step === 2 && (
          <Button
            onClick={handleAnalyze}
            disabled={!canProceed() || analyzing}
            className="btn-gradient text-white"
          >
            {analyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Analyze & Assign Agents
              </>
            )}
          </Button>
        )}

        {step === 3 && analysis && (
          <Button
            onClick={() => setStep(4)}
            className="btn-gradient text-white"
          >
            Review
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}

        {step === 4 && (
          <Button
            onClick={handleCreate}
            disabled={creating}
            className="btn-gradient text-white"
          >
            {creating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                {t("wizard.create")}
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// Helper import for agent lookup
import { getAgentByName } from "@/lib/agents";
