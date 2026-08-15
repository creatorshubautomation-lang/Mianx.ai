"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TEMPLATES,
  CATEGORIES,
  type ProjectTemplate,
  type TemplateCategory,
} from "@/lib/templates";
import {
  Sparkles,
  Crown,
  Clock,
  Check,
  Search,
  Filter,
  ArrowRight,
  Zap,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

export function TemplatesView() {
  const { navigate, setAuthModal } = useApp();
  const [selectedCategory, setSelectedCategory] = useState<
    TemplateCategory | "all"
  >("all");
  const [search, setSearch] = useState("");
  const [selectedTemplate, setSelectedTemplate] =
    useState<ProjectTemplate | null>(null);

  // Filter templates
  const filtered = TEMPLATES.filter((t) => {
    const matchesCategory =
      selectedCategory === "all" || t.category === selectedCategory;
    const matchesSearch =
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleUseTemplate = (template: ProjectTemplate) => {
    setSelectedTemplate(template);
  };

  const handleConfirmUse = () => {
    if (!selectedTemplate) return;

    // Store template info in localStorage for the wizard to pick up
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "mianx_selected_template",
        JSON.stringify({
          id: selectedTemplate.id,
          name: selectedTemplate.name,
          projectType: selectedTemplate.defaultProjectType,
          description: selectedTemplate.defaultDescription,
          requiredAgents: selectedTemplate.requiredAgents,
        }),
      );
    }

    toast.success(`Starting ${selectedTemplate.name}...`);
    navigate("newProject");
  };

  return (
    <div className="relative min-h-screen pt-24 pb-20">
      <div className="fixed inset-0 mesh-bg-soft -z-10" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 mb-4 text-xs">
            <Sparkles className="h-3.5 w-3.5 text-purple-400" />
            <span className="text-muted-foreground">
              {TEMPLATES.length} templates · {TEMPLATES.filter((t) => !t.isPremium).length} free ·{" "}
              {TEMPLATES.filter((t) => t.isPremium).length} premium
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold">
            Project <span className="gradient-text">Templates</span>
          </h1>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Start instantly with pre-built templates. Customize, deploy, and launch in record time.
          </p>
        </div>

        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-md glass border-purple-500/10 bg-transparent text-sm focus:outline-none focus:border-purple-500/30"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap ${
                selectedCategory === "all"
                  ? "btn-gradient text-white"
                  : "glass"
              }`}
            >
              All
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap ${
                  selectedCategory === cat.id
                    ? "btn-gradient text-white"
                    : "glass"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Templates grid */}
        {filtered.length === 0 ? (
          <Card className="glass border-purple-500/10 p-12 text-center">
            <Filter className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              No templates found. Try different filters.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((template, i) => (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="glass border-purple-500/10 p-5 h-full flex flex-col card-hover">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className={`inline-flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br ${template.color}`}
                    >
                      <TemplateIcon name={template.icon} />
                    </div>
                    <div className="flex gap-1">
                      {template.isPremium && (
                        <Badge className="bg-amber-500/20 text-amber-300 text-xs">
                          <Crown className="h-3 w-3 mr-1" />
                          Pro
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs glass">
                        {template.category}
                      </Badge>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="font-semibold text-lg mb-1">{template.name}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                    {template.description}
                  </p>

                  {/* Meta */}
                  <div className="flex items-center gap-3 mb-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {template.estimatedDays} days
                    </span>
                    <span className="flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      {template.requiredAgents.length} agents
                    </span>
                    <span className="flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      {template.popularity}%
                    </span>
                  </div>

                  {/* Features */}
                  <div className="space-y-1 mb-4 flex-1">
                    {template.features.slice(0, 4).map((f) => (
                      <div
                        key={f}
                        className="flex items-start gap-2 text-xs"
                      >
                        <Check className="h-3 w-3 text-green-400 mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground">{f}</span>
                      </div>
                    ))}
                    {template.features.length > 4 && (
                      <p className="text-xs text-purple-300">
                        +{template.features.length - 4} more
                      </p>
                    )}
                  </div>

                  {/* Tech stack */}
                  <div className="flex flex-wrap gap-1 mb-4">
                    {template.techStack.slice(0, 3).map((tech) => (
                      <span
                        key={tech}
                        className="text-xs px-2 py-0.5 rounded glass"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>

                  {/* CTA */}
                  <Button
                    onClick={() => handleUseTemplate(template)}
                    className="w-full btn-gradient text-white"
                    size="sm"
                  >
                    Use Template
                    <ArrowRight className="ml-2 h-3 w-3" />
                  </Button>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Template confirmation modal */}
      {selectedTemplate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setSelectedTemplate(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-strong border-purple-500/20 rounded-2xl p-6 max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4 mb-4">
              <div
                className={`flex-shrink-0 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br ${selectedTemplate.color}`}
              >
                <TemplateIcon name={selectedTemplate.icon} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg">
                  {selectedTemplate.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {selectedTemplate.description}
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-5">
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  What&apos;s included
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {selectedTemplate.features.map((f) => (
                    <div
                      key={f}
                      className="flex items-start gap-2 text-xs"
                    >
                      <Check className="h-3 w-3 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  AI Agent Team ({selectedTemplate.requiredAgents.length} agents)
                </h4>
                <div className="flex flex-wrap gap-1">
                  {selectedTemplate.requiredAgents.map((agent) => (
                    <span
                      key={agent}
                      className="text-xs px-2 py-1 rounded glass"
                    >
                      {agent}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4 p-3 glass rounded-md">
                <div className="text-center">
                  <div className="text-lg font-bold gradient-text">
                    {selectedTemplate.estimatedDays}
                  </div>
                  <div className="text-xs text-muted-foreground">days</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold gradient-text">
                    {selectedTemplate.requiredAgents.length}
                  </div>
                  <div className="text-xs text-muted-foreground">agents</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold gradient-text">
                    {selectedTemplate.features.length}
                  </div>
                  <div className="text-xs text-muted-foreground">features</div>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setSelectedTemplate(null)}
                className="flex-1 glass"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmUse}
                className="flex-1 btn-gradient text-white"
              >
                Start Project
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
//  Dynamic icon renderer
// ─────────────────────────────────────────────

function TemplateIcon({ name }: { name: string }) {
  // Map icon names to lucide icons
  const iconMap: Record<string, React.ReactNode> = {
    ShoppingBag: <ShoppingBagIcon />,
    Palette: <PaletteIcon />,
    Rocket: <RocketIcon />,
    FileText: <FileTextIcon />,
    UtensilsCrossed: <UtensilsIcon />,
    Building2: <BuildingIcon />,
    GraduationCap: <GraduationIcon />,
    HeartPulse: <HeartIcon />,
    TrendingUp: <TrendingIcon />,
    Users: <UsersIcon />,
  };

  return (
    <span className="text-white">
      {iconMap[name] || <Sparkles className="h-5 w-5" />}
    </span>
  );
}

// Inline icon components (using lucide-react)
import {
  ShoppingBag,
  Palette,
  Rocket,
  FileText,
  UtensilsCrossed,
  Building2,
  GraduationCap,
  HeartPulse,
  TrendingUp,
  Users,
} from "lucide-react";

const ShoppingBagIcon = () => <ShoppingBag className="h-5 w-5" />;
const PaletteIcon = () => <Palette className="h-5 w-5" />;
const RocketIcon = () => <Rocket className="h-5 w-5" />;
const FileTextIcon = () => <FileText className="h-5 w-5" />;
const UtensilsIcon = () => <UtensilsCrossed className="h-5 w-5" />;
const BuildingIcon = () => <Building2 className="h-5 w-5" />;
const GraduationIcon = () => <GraduationCap className="h-5 w-5" />;
const HeartIcon = () => <HeartPulse className="h-5 w-5" />;
const TrendingIcon = () => <TrendingUp className="h-5 w-5" />;
const UsersIcon = () => <Users className="h-5 w-5" />;
