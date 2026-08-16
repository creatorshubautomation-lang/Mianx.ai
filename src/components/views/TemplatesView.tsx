"use client";

import { useEffect, useState, useCallback } from "react";
import { useApp } from "@/lib/store";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
  Heart,
  Star,
  Loader2,
  Plus,
  Briefcase,
  Brain,
  MessageSquare,
  Package,
  Users,
  Wrench,
  ChevronRight,
  Trash2,
  Rocket,
  Eye,
  TrendingUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

interface UsageMap {
  [templateId: string]: number;
}

// ─────────────────────────────────────────────
//  Sub-components
// ─────────────────────────────────────────────

function DifficultyBadge({ difficulty }: { difficulty?: string }) {
  if (!difficulty) return null;
  const config = {
    beginner: { label: "Beginner", className: "bg-green-500/15 text-green-300 border-green-500/20" },
    intermediate: { label: "Intermediate", className: "bg-amber-500/15 text-amber-300 border-amber-500/20" },
    advanced: { label: "Advanced", className: "bg-red-500/15 text-red-300 border-red-500/20" },
  }[difficulty] || { label: difficulty, className: "bg-purple-500/15 text-purple-300" };

  return (
    <Badge variant="outline" className={`text-[10px] border ${config.className}`}>
      {config.label}
    </Badge>
  );
}

function ShimmerCard() {
  return (
    <Card className="glass border-purple-500/10 p-5 h-full flex flex-col">
      <div className="flex items-start gap-3 mb-3">
        <div className="h-11 w-11 rounded-lg bg-muted animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
          <div className="h-3 w-full rounded bg-muted animate-pulse" />
        </div>
      </div>
      <div className="space-y-2 mb-4">
        <div className="h-3 w-full rounded bg-muted animate-pulse" />
        <div className="h-3 w-4/5 rounded bg-muted animate-pulse" />
      </div>
      <div className="flex gap-2 mb-4">
        <div className="h-3 w-12 rounded bg-muted animate-pulse" />
        <div className="h-3 w-16 rounded bg-muted animate-pulse" />
      </div>
      <div className="mt-auto pt-3 border-t border-purple-500/10">
        <div className="h-8 w-full rounded bg-muted animate-pulse" />
      </div>
    </Card>
  );
}

function TemplateIconDynamic({ name }: { name: string }) {
  const iconMap: Record<string, React.ReactNode> = {
    ShoppingBag: <ShoppingBag className="h-5 w-5" />,
    Palette: <Palette className="h-5 w-5" />,
    Rocket: <Rocket className="h-5 w-5" />,
    FileText: <FileText className="h-5 w-5" />,
    UtensilsCrossed: <UtensilsCrossed className="h-5 w-5" />,
    Building2: <Building2 className="h-5 w-5" />,
    GraduationCap: <GraduationCap className="h-5 w-5" />,
    HeartPulse: <HeartPulse className="h-5 w-5" />,
    TrendingUp: <TrendingUp className="h-5 w-5" />,
    Users: <Users className="h-5 w-5" />,
    Sparkles: <Sparkles className="h-5 w-5" />,
    Briefcase: <Briefcase className="h-5 w-5" />,
    Brain: <Brain className="h-5 w-5" />,
    MessageSquare: <MessageSquare className="h-5 w-5" />,
  };
  return <span className="text-white">{iconMap[name] || <Sparkles className="h-5 w-5" />}</span>;
}

// Import icons
import {
  ShoppingBag,
  Palette,
  FileText,
  UtensilsCrossed,
  Building2,
  GraduationCap,
  HeartPulse,
} from "lucide-react";

// ─────────────────────────────────────────────
//  Main Component
// ─────────────────────────────────────────────

export function TemplatesView() {
  const { navigate, setAuthModal } = useApp();
  const { data: session } = useSession();

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | "all">("all");
  const [search, setSearch] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [priceFilter, setPriceFilter] = useState<string>("all");

  // State
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  // Backend state
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [usageMap, setUsageMap] = useState<UsageMap>({});
  const [customTemplates, setCustomTemplates] = useState<ProjectTemplate[]>([]);
  const [activeTab, setActiveTab] = useState<"browse" | "favorites" | "custom">("browse");

  // ─── Fetch favorites ───
  const fetchFavorites = useCallback(() => {
    if (!session?.user?.id) return;
    fetch("/api/templates/favorites")
      .then((r) => r.json())
      .then((data) => {
        if (data.favorites) setFavoriteIds(new Set(data.favorites));
      })
      .catch(() => {});
  }, [session?.user?.id]);

  // ─── Fetch usage counts ───
  useEffect(() => {
    fetch("/api/templates/usage")
      .then((r) => r.json())
      .then((data) => {
        if (data.usage) {
          const map: UsageMap = {};
          data.usage.forEach((u: { templateId: string; count: number }) => {
            map[u.templateId] = u.count;
          });
          setUsageMap(map);
        }
      })
      .catch(() => {});
  }, []);

  // ─── Fetch favorites on mount ───
  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  // ─── Fetch custom templates ───
  const fetchCustom = useCallback(() => {
    if (!session?.user?.id) return;
    fetch("/api/templates/custom")
      .then((r) => r.json())
      .then((data) => {
        if (data.templates) setCustomTemplates(data.templates);
      })
      .catch(() => {});
  }, [session?.user?.id]);

  useEffect(() => {
    fetchCustom();
  }, [fetchCustom]);

  // ─── Filter templates ───
  const allTemplates = [...TEMPLATES, ...customTemplates];

  const filtered = allTemplates.filter((t) => {
    const matchesCategory = selectedCategory === "all" || t.category === selectedCategory;
    const matchesSearch =
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.features.some((f) => f.toLowerCase().includes(search.toLowerCase())) ||
      t.techStack.some((s) => s.toLowerCase().includes(search.toLowerCase()));
    const matchesDifficulty = difficultyFilter === "all" || t.difficulty === difficultyFilter;
    const matchesPrice = priceFilter === "all" ||
      (priceFilter === "free" && !t.isPremium) ||
      (priceFilter === "premium" && t.isPremium);
    return matchesCategory && matchesSearch && matchesDifficulty && matchesPrice;
  });

  const favoriteTemplates = allTemplates.filter((t) => favoriteIds.has(t.id));

  // ─── Handlers ───
  const toggleFavorite = (templateId: string) => {
    if (!session?.user?.id) {
      setAuthModal("login");
      return;
    }
    const isFav = favoriteIds.has(templateId);
    fetch("/api/templates/favorites", {
      method: isFav ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId }),
    })
      .then(() => {
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (isFav) next.delete(templateId);
          else next.add(templateId);
          return next;
        });
        toast.success(isFav ? "Removed from favorites" : "Added to favorites!");
      })
      .catch(() => toast.error("Failed to update favorite"));
  };

  const handleUseTemplate = (template: ProjectTemplate) => {
    setSelectedTemplate(template);
    setDetailOpen(true);
  };

  const handleConfirmUse = () => {
    if (!selectedTemplate) return;

    // Store template info in localStorage for the wizard
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "mianx_selected_template",
        JSON.stringify({
          id: selectedTemplate.id,
          name: selectedTemplate.name,
          projectType: selectedTemplate.defaultProjectType,
          description: selectedTemplate.missionObjective || selectedTemplate.defaultDescription,
          requiredAgents: selectedTemplate.requiredAgents,
          suggestedTools: selectedTemplate.suggestedTools || [],
        }),
      );
    }

    // Track usage
    fetch("/api/templates/usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: selectedTemplate.id }),
    }).catch(() => {});

    toast.success(`Starting ${selectedTemplate.name}...`);
    setDetailOpen(false);
    navigate("newProject");
  };

  const handleDeleteCustom = (id: string) => {
    fetch("/api/templates/custom", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.deleted) {
          toast.success("Template deleted");
          fetchCustom();
        }
      })
      .catch(() => toast.error("Failed to delete template"));
  };

  // Popular templates (top 4)
  const popular = [...TEMPLATES].sort((a, b) => b.popularity - a.popularity).slice(0, 4);

  return (
    <div className="relative min-h-screen pt-24 pb-20">
      <div className="fixed inset-0 mesh-bg-soft -z-10" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* ─── Hero ─── */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 mb-4 text-xs">
            <Sparkles className="h-4 w-4 text-purple-400" />
            <span className="text-muted-foreground">
              {TEMPLATES.length} templates &middot; {TEMPLATES.filter((t) => !t.isPremium).length} free &middot;{" "}
              {TEMPLATES.filter((t) => t.isPremium).length} premium
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold">
            Project <span className="gradient-text">Templates</span>
          </h1>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto text-sm leading-relaxed">
            Start instantly with pre-built templates. Each one comes with a mission-ready
            brief, tool recommendations, and the perfect AI agent team.
          </p>
        </div>

        {/* ─── Popular Quick-Browse ─── */}
        {selectedCategory === "all" && !search && activeTab === "browse" && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-semibold">Most Popular</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {popular.map((t) => (
                <motion.button
                  key={t.id}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleUseTemplate(t)}
                  className="text-left"
                >
                  <div className="p-3 rounded-xl glass border-purple-500/10 hover:border-purple-500/30 transition-colors">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${t.color} mb-2`}>
                      <TemplateIconDynamic name={t.icon} />
                    </div>
                    <p className="text-xs font-medium truncate">{t.name}</p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                      <span>{t.estimatedDays}d</span>
                      <span>{t.requiredAgents.length} agents</span>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* ─── Tabs ─── */}
        <div className="flex items-center gap-1 p-1 rounded-lg glass w-fit mb-6">
          {[
            { id: "browse" as const, label: "Browse All", icon: <Package className="h-3.5 w-3.5 mr-1.5" /> },
            { id: "favorites" as const, label: "Favorites", icon: <Heart className="h-3.5 w-3.5 mr-1.5" />, count: favoriteIds.size },
            { id: "custom" as const, label: "My Templates", icon: <Plus className="h-3.5 w-3.5 mr-1.5" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1 px-4 py-2 rounded-md text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-purple-500/20 text-purple-300"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.icon}
              {tab.label}
              {"count" in tab && tab.count! > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px]">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "browse" ? (
            <motion.div key="browse" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* ─── Search + Filters ─── */}
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search templates, features, tech stack..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-lg glass border-purple-500/10 bg-transparent text-sm focus:outline-none focus:border-purple-500/30"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={difficultyFilter}
                    onChange={(e) => setDifficultyFilter(e.target.value)}
                    className="px-3 py-2 rounded-lg glass border-purple-500/10 bg-transparent text-xs appearance-none cursor-pointer focus:outline-none"
                  >
                    <option value="all">All Levels</option>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                  <select
                    value={priceFilter}
                    onChange={(e) => setPriceFilter(e.target.value)}
                    className="px-3 py-2 rounded-lg glass border-purple-500/10 bg-transparent text-xs appearance-none cursor-pointer focus:outline-none"
                  >
                    <option value="all">All Prices</option>
                    <option value="free">Free</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
              </div>

              {/* Category chips */}
              <div className="flex gap-2 overflow-x-auto no-scrollbar mb-6">
                <button
                  onClick={() => setSelectedCategory("all")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === "all" ? "btn-gradient text-white" : "glass hover:bg-purple-500/10"
                  }`}
                >
                  <Package className="h-3 w-3" />
                  All
                </button>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                      selectedCategory === cat.id ? "btn-gradient text-white" : "glass hover:bg-purple-500/10"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* ─── Grid ─── */}
              {filtered.length === 0 ? (
                <Card className="glass border-purple-500/10 p-12 text-center">
                  <Filter className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">No templates found. Try different filters.</p>
                  <Button className="btn-gradient text-white" onClick={() => { setCreateOpen(true); }}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Template
                  </Button>
                </Card>
              ) : (
                <>
                  <div className="text-xs text-muted-foreground mb-3">
                    {filtered.length} template{filtered.length !== 1 ? "s" : ""}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filtered.map((template, i) => (
                      <motion.div
                        key={template.id}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.04 }}
                      >
                        <Card className="glass border-purple-500/10 p-5 h-full flex flex-col card-hover group">
                          {/* Header */}
                          <div className="flex items-start justify-between mb-3">
                            <div className={`inline-flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br ${template.color}`}>
                              <TemplateIconDynamic name={template.icon} />
                            </div>
                            <div className="flex gap-1">
                              {template.isPremium && (
                                <Badge className="bg-amber-500/20 text-amber-300 text-[10px]">
                                  <Crown className="h-3 w-3 mr-1" />
                                  Pro
                                </Badge>
                              )}
                              <DifficultyBadge difficulty={template.difficulty} />
                            </div>
                          </div>

                          {/* Title */}
                          <h3 className="font-semibold text-sm mb-1 group-hover:text-purple-300 transition-colors">{template.name}</h3>
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{template.description}</p>

                          {/* Meta */}
                          <div className="flex items-center gap-3 mb-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{template.estimatedDays}d</span>
                            <span className="flex items-center gap-1"><Zap className="h-3 w-3" />{template.requiredAgents.length} agents</span>
                            {usageMap[template.id] !== undefined && (
                              <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{usageMap[template.id]}</span>
                            )}
                          </div>

                          {/* Features */}
                          <div className="space-y-1 mb-3 flex-1">
                            {template.features.slice(0, 3).map((f) => (
                              <div key={f} className="flex items-start gap-2 text-xs">
                                <Check className="h-3 w-3 text-green-400 mt-0.5 flex-shrink-0" />
                                <span className="text-muted-foreground">{f}</span>
                              </div>
                            ))}
                            {template.features.length > 3 && (
                              <p className="text-xs text-purple-300">+{template.features.length - 3} more</p>
                            )}
                          </div>

                          {/* Tech stack */}
                          <div className="flex flex-wrap gap-1 mb-4">
                            {template.techStack.slice(0, 4).map((tech) => (
                              <span key={tech} className="text-[10px] px-1.5 py-0.5 rounded glass">{tech}</span>
                            ))}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 mt-auto pt-3 border-t border-purple-500/10">
                            <Button onClick={() => handleUseTemplate(template)} className="flex-1 btn-gradient text-white" size="sm">
                              Use Template
                              <ArrowRight className="ml-1.5 h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-8 px-2 ${favoriteIds.has(template.id) ? "text-red-400" : "text-muted-foreground"}`}
                              onClick={() => toggleFavorite(template.id)}
                            >
                              <Heart className={`h-3.5 w-3.5 ${favoriteIds.has(template.id) ? "fill-current" : ""}`} />
                            </Button>
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          ) : activeTab === "favorites" ? (
            <motion.div key="favorites" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {!session?.user?.id ? (
                <Card className="glass border-purple-500/10 p-12 text-center">
                  <Heart className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                  <h3 className="font-semibold text-lg mb-2">Sign in Required</h3>
                  <p className="text-sm text-muted-foreground mb-6">Sign in to save your favorite templates.</p>
                  <Button className="btn-gradient text-white" onClick={() => setAuthModal("login")}>Sign In</Button>
                </Card>
              ) : favoriteTemplates.length === 0 ? (
                <Card className="glass border-purple-500/10 p-12 text-center">
                  <Heart className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                  <h3 className="font-semibold text-lg mb-2">No Favorites Yet</h3>
                  <p className="text-sm text-muted-foreground mb-6">Click the heart icon on any template to save it here.</p>
                  <Button className="btn-gradient text-white" onClick={() => setActiveTab("browse")}>Browse Templates</Button>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {favoriteTemplates.map((template, i) => (
                    <motion.div key={template.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }}>
                      <Card className="glass border-purple-500/10 p-5 h-full flex flex-col card-hover">
                        <div className="flex items-start justify-between mb-3">
                          <div className={`inline-flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br ${template.color}`}>
                            <TemplateIconDynamic name={template.icon} />
                          </div>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-red-400" onClick={() => toggleFavorite(template.id)}>
                            <Heart className="h-4 w-4 fill-current" />
                          </Button>
                        </div>
                        <h3 className="font-semibold text-sm mb-1">{template.name}</h3>
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{template.description}</p>
                        <Button onClick={() => handleUseTemplate(template)} className="w-full btn-gradient text-white mt-auto" size="sm">
                          Use Template <ArrowRight className="ml-1.5 h-3 w-3" />
                        </Button>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div key="custom" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {!session?.user?.id ? (
                <Card className="glass border-purple-500/10 p-12 text-center">
                  <Plus className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                  <h3 className="font-semibold text-lg mb-2">Sign in Required</h3>
                  <p className="text-sm text-muted-foreground mb-6">Sign in to create custom templates.</p>
                  <Button className="btn-gradient text-white" onClick={() => setAuthModal("login")}>Sign In</Button>
                </Card>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-6">
                    <div className="text-xs text-muted-foreground">
                      {customTemplates.length} custom template{customTemplates.length !== 1 ? "s" : ""}
                    </div>
                    <Button size="sm" className="btn-gradient text-white h-8" onClick={() => setCreateOpen(true)}>
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Create Template
                    </Button>
                  </div>
                  {customTemplates.length === 0 ? (
                    <Card className="glass border-purple-500/10 p-12 text-center">
                      <Sparkles className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                      <h3 className="font-semibold text-lg mb-2">No Custom Templates</h3>
                      <p className="text-sm text-muted-foreground mb-6">
                        Create your own reusable project templates with custom features, tech stacks, and agent teams.
                      </p>
                      <Button className="btn-gradient text-white" onClick={() => setCreateOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Your First Template
                      </Button>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {customTemplates.map((template, i) => (
                        <motion.div key={template.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }}>
                          <Card className="glass border-purple-500/10 p-5 h-full flex flex-col card-hover">
                            <div className="flex items-start justify-between mb-3">
                              <div className={`inline-flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br ${template.color}`}>
                                <TemplateIconDynamic name={template.icon} />
                              </div>
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-red-400" onClick={() => handleDeleteCustom(template.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <h3 className="font-semibold text-sm mb-1">{template.name}</h3>
                            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{template.description}</p>
                            <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{template.estimatedDays}d</span>
                              <span className="flex items-center gap-1"><Zap className="h-3 w-3" />{template.requiredAgents.length} agents</span>
                            </div>
                            <Button onClick={() => handleUseTemplate(template)} className="w-full btn-gradient text-white mt-auto" size="sm">
                              Use Template <ArrowRight className="ml-1.5 h-3 w-3" />
                            </Button>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── Template Detail Dialog ─── */}
      <Dialog open={detailOpen} onOpenChange={(v) => !v && setDetailOpen(false)}>
        <DialogContent className="glass border-purple-500/20 max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br ${selectedTemplate?.color} shadow-lg`}>
                {selectedTemplate && <TemplateIconDynamic name={selectedTemplate.icon} />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-xl">{selectedTemplate?.name}</DialogTitle>
                  {selectedTemplate?.isPremium && (
                    <Badge className="bg-amber-500/20 text-amber-300 text-xs"><Crown className="h-3 w-3 mr-1" />Pro</Badge>
                  )}
                  <DifficultyBadge difficulty={selectedTemplate?.difficulty} />
                </div>
                <DialogDescription className="mt-1 text-sm">{selectedTemplate?.description}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {selectedTemplate && (
            <div className="space-y-5 mt-2">
              {/* Stats bar */}
              <div className="flex items-center gap-4 p-3 glass rounded-lg">
                <div className="text-center flex-1">
                  <div className="text-lg font-bold gradient-text">{selectedTemplate.estimatedDays}</div>
                  <div className="text-[10px] text-muted-foreground">Days</div>
                </div>
                <div className="text-center flex-1">
                  <div className="text-lg font-bold gradient-text">{selectedTemplate.requiredAgents.length}</div>
                  <div className="text-[10px] text-muted-foreground">Agents</div>
                </div>
                <div className="text-center flex-1">
                  <div className="text-lg font-bold gradient-text">{selectedTemplate.features.length}</div>
                  <div className="text-[10px] text-muted-foreground">Features</div>
                </div>
                {usageMap[selectedTemplate.id] !== undefined && (
                  <div className="text-center flex-1">
                    <div className="text-lg font-bold gradient-text">{usageMap[selectedTemplate.id]}</div>
                    <div className="text-[10px] text-muted-foreground">Uses</div>
                  </div>
                )}
                <div className="text-center flex-1">
                  <div className="text-lg font-bold gradient-text">{selectedTemplate.popularity}%</div>
                  <div className="text-[10px] text-muted-foreground">Popular</div>
                </div>
              </div>

              {/* Mission Objective */}
              {selectedTemplate.missionObjective && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Rocket className="h-4 w-4 text-purple-400" />
                    Mission Brief
                  </h4>
                  <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/10 text-sm text-muted-foreground leading-relaxed">
                    {selectedTemplate.missionObjective}
                  </div>
                </div>
              )}

              {/* Features */}
              <div>
                <h4 className="text-sm font-semibold mb-2">What&apos;s Included</h4>
                <div className="grid grid-cols-2 gap-2">
                  {selectedTemplate.features.map((f) => (
                    <div key={f} className="flex items-start gap-2 text-xs">
                      <Check className="h-3 w-3 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Agent Team */}
              <div>
                <h4 className="text-sm font-semibold mb-2">AI Agent Team ({selectedTemplate.requiredAgents.length})</h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedTemplate.requiredAgents.map((agent) => (
                    <Badge key={agent} variant="outline" className="text-xs glass">{agent}</Badge>
                  ))}
                </div>
              </div>

              {/* Suggested Tools */}
              {selectedTemplate.suggestedTools && selectedTemplate.suggestedTools.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-cyan-400" />
                    Suggested Tools
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTemplate.suggestedTools.map((tool) => (
                      <Badge key={tool} className="bg-cyan-500/15 text-cyan-300 text-xs border border-cyan-500/20">{tool}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Tech Stack */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Tech Stack</h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedTemplate.techStack.map((tech) => (
                    <span key={tech} className="text-xs px-2 py-1 rounded glass">{tech}</span>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t border-purple-500/10">
                <Button variant="outline" onClick={() => setDetailOpen(false)} className="flex-1 glass">
                  Cancel
                </Button>
                <Button
                  variant="ghost"
                  className={favoriteIds.has(selectedTemplate.id) ? "text-red-400" : ""}
                  onClick={() => toggleFavorite(selectedTemplate.id)}
                >
                  <Heart className={`h-4 w-4 mr-1.5 ${favoriteIds.has(selectedTemplate.id) ? "fill-current" : ""}`} />
                  {favoriteIds.has(selectedTemplate.id) ? "Favorited" : "Favorite"}
                </Button>
                <Button onClick={handleConfirmUse} className="flex-1 btn-gradient text-white">
                  Start Project
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Create Custom Template Dialog ─── */}
      <Dialog open={createOpen} onOpenChange={(v) => !v && setCreateOpen(false)}>
        <DialogContent className="glass border-purple-500/20 max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-400" />
              Create Custom Template
            </DialogTitle>
            <DialogDescription>Build a reusable project template with custom settings.</DialogDescription>
          </DialogHeader>

          <CreateTemplateForm
            onSuccess={() => {
              setCreateOpen(false);
              fetchCustom();
              toast.success("Template created!");
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Create Template Form
// ─────────────────────────────────────────────

function CreateTemplateForm({ onSuccess }: { onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("custom");
  const [features, setFeatures] = useState("");
  const [techStack, setTechStack] = useState("");
  const [agents, setAgents] = useState("");
  const [days, setDays] = useState("3");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = () => {
    if (!name.trim() || !description.trim()) {
      toast.error("Name and description are required");
      return;
    }
    setSubmitting(true);
    fetch("/api/templates/custom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim(),
        category,
        features: features.split(",").map((f) => f.trim()).filter(Boolean),
        techStack: techStack.split(",").map((t) => t.trim()).filter(Boolean),
        requiredAgents: agents.split(",").map((a) => a.trim()).filter(Boolean),
        estimatedDays: parseInt(days) || 3,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) onSuccess();
        else toast.error(data.error || "Failed to create template");
      })
      .catch(() => toast.error("Failed to create template"))
      .finally(() => setSubmitting(false));
  };

  return (
    <div className="space-y-4 mt-4">
      <div>
        <label className="text-sm font-medium mb-1 block">Template Name *</label>
        <Input placeholder="e.g., SaaS Starter Kit" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className="bg-purple-500/5 border-purple-500/20" />
      </div>
      <div>
        <label className="text-sm font-medium mb-1 block">Description *</label>
        <Textarea placeholder="What does this template build?" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={2} className="bg-purple-500/5 border-purple-500/20" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium mb-1 block">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 rounded-lg glass border-purple-500/10 bg-transparent text-xs focus:outline-none">
            {CATEGORIES.map((cat) => (<option key={cat.id} value={cat.id}>{cat.label}</option>))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Estimated Days</label>
          <Input type="number" min="1" max="30" value={days} onChange={(e) => setDays(e.target.value)} className="bg-purple-500/5 border-purple-500/20" />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium mb-1 block">Features (comma-separated)</label>
        <Input placeholder="e.g., User auth, Dashboard, Billing" value={features} onChange={(e) => setFeatures(e.target.value)} className="bg-purple-500/5 border-purple-500/20" />
      </div>
      <div>
        <label className="text-sm font-medium mb-1 block">Tech Stack (comma-separated)</label>
        <Input placeholder="e.g., Next.js, Prisma, Stripe" value={techStack} onChange={(e) => setTechStack(e.target.value)} className="bg-purple-500/5 border-purple-500/20" />
      </div>
      <div>
        <label className="text-sm font-medium mb-1 block">Required Agents (comma-separated)</label>
        <Input placeholder="e.g., Zen, Atlas, Vega" value={agents} onChange={(e) => setAgents(e.target.value)} className="bg-purple-500/5 border-purple-500/20" />
      </div>
      <Button className="w-full btn-gradient text-white" onClick={handleSubmit} disabled={submitting}>
        {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
        Create Template
      </Button>
    </div>
  );
}
