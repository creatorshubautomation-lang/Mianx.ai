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
import { toast } from "sonner";
import {
  Bot,
  Download,
  Star,
  Loader2,
  Search,
  Plus,
  Check,
  TrendingUp,
  Sparkles,
  ShieldCheck,
  Package,
  Tag,
  Users,
  ChevronRight,
  Trash2,
  ExternalLink,
  Heart,
  StarOff,
  ArrowUpDown,
  LayoutGrid,
  List,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

interface MarketplaceAgent {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  color: string;
  price: number;
  rating: number;
  downloadCount: number;
  isVerified: boolean;
  capabilities?: string[];
  tags?: string[];
  createdAt?: string;
}

interface AgentDetail extends MarketplaceAgent {
  avgRating: number;
  totalReviews: number;
  installCount: number;
  ratingDistribution: number[];
}

interface Review {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  userName: string;
  userAvatar: string | null;
  createdAt: string;
}

interface MarketplaceStats {
  totalAgents: number;
  totalInstalls: number;
  totalReviews: number;
  verifiedCount: number;
  categories: { name: string; count: number }[];
}

const CATEGORIES = [
  { id: "all", label: "All", icon: LayoutGrid },
  { id: "general", label: "General", icon: Bot },
  { id: "legal", label: "Legal", icon: ShieldCheck },
  { id: "finance", label: "Finance", icon: TrendingUp },
  { id: "health", label: "Health", icon: Heart },
  { id: "education", label: "Education", icon: Sparkles },
  { id: "real_estate", label: "Real Estate", icon: Package },
  { id: "custom", label: "Custom", icon: Tag },
];

const SORT_OPTIONS = [
  { id: "popular", label: "Most Popular" },
  { id: "newest", label: "Newest" },
  { id: "rating", label: "Top Rated" },
  { id: "free", label: "Free First" },
];

// ─────────────────────────────────────────────
//  Sub-components
// ─────────────────────────────────────────────

function StarRating({
  rating,
  size = "sm",
  interactive = false,
  onChange,
}: {
  rating: number;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onChange?: (r: number) => void;
}) {
  const sz = size === "sm" ? 14 : size === "md" ? 18 : 24;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          onClick={() => interactive && onChange?.(star)}
          className={`${interactive ? "cursor-pointer hover:scale-110" : "cursor-default"} transition-transform`}
        >
          <Star
            className={`${sz <= 14 ? "h-3.5 w-3.5" : sz <= 18 ? "h-4 w-4" : "h-5 w-5"} ${
              star <= rating
                ? "fill-amber-400 text-amber-400"
                : "fill-muted text-muted"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function AgentCard({
  agent,
  isInstalled,
  onViewDetail,
  onInstall,
  onUninstall,
}: {
  agent: MarketplaceAgent;
  isInstalled: boolean;
  onViewDetail: (id: string) => void;
  onInstall: (id: string) => void;
  onUninstall: (id: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3 }}
    >
      <Card className="glass border-purple-500/10 p-5 h-full flex flex-col card-hover group">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${agent.color} shadow-lg`}
          >
            <Bot className="h-6 w-6 text-white" />
          </div>
          <div className="flex items-center gap-2">
            {agent.isVerified && (
              <Badge className="bg-blue-500/20 text-blue-300 text-[10px] border-0">
                <ShieldCheck className="h-3 w-3 mr-1" />
                Verified
              </Badge>
            )}
            {isInstalled && (
              <Badge className="bg-green-500/20 text-green-300 text-[10px] border-0">
                <Check className="h-3 w-3 mr-1" />
                Installed
              </Badge>
            )}
          </div>
        </div>

        {/* Info */}
        <h3 className="font-semibold text-sm mb-1 group-hover:text-purple-300 transition-colors">
          {agent.name}
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
          {agent.description}
        </p>

        {/* Tags */}
        {agent.tags && agent.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {agent.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-3 mb-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
            <span className="font-medium text-foreground">{agent.rating}</span>
          </span>
          <span className="flex items-center gap-1">
            <Download className="h-3 w-3" />
            {agent.downloadCount.toLocaleString()}
          </span>
          <Badge variant="outline" className="text-[10px] glass capitalize">
            {agent.category.replace("_", " ")}
          </Badge>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-purple-500/10">
          <div className="text-lg font-bold">
            {agent.price === 0 ? (
              <span className="text-green-400 text-sm font-semibold">FREE</span>
            ) : (
              <span>${agent.price}</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onViewDetail(agent.id)}
            >
              Details
              <ChevronRight className="h-3 w-3 ml-0.5" />
            </Button>
            {isInstalled ? (
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-3 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                onClick={() => onUninstall(agent.id)}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Remove
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-7 px-3 text-xs btn-gradient text-white"
                onClick={() => onInstall(agent.id)}
              >
                {agent.price === 0 ? (
                  <>
                    <Download className="h-3 w-3 mr-1" />
                    Install
                  </>
                ) : (
                  "Buy"
                )}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function AgentDetailDialog({
  agent,
  open,
  onClose,
  isInstalled,
  onInstall,
  onUninstall,
}: {
  agent: AgentDetail | null;
  open: boolean;
  onClose: () => void;
  isInstalled: boolean;
  onInstall: () => void;
  onUninstall: () => void;
}) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewPage, setReviewPage] = useState(1);
  const [totalReviews, setTotalReviews] = useState(0);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  useEffect(() => {
    if (agent && open) {
      setReviewPage(1);
      fetchReviews(1);
    }
  }, [agent, open]);

  const fetchReviews = (page: number) => {
    if (!agent) return;
    setReviewsLoading(true);
    fetch(`/api/marketplace/agents/${agent.id}/reviews?page=${page}&limit=5`)
      .then((r) => r.json())
      .then((data) => {
        if (data.reviews) {
          setReviews(page === 1 ? data.reviews : (prev) => [...prev, ...data.reviews]);
          setTotalReviews(data.total);
        }
      })
      .finally(() => setReviewsLoading(false));
  };

  if (!agent) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="glass border-purple-500/20 max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-4">
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br ${agent.color} shadow-lg flex-shrink-0`}
            >
              <Bot className="h-8 w-8 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-xl">{agent.name}</DialogTitle>
                {agent.isVerified && (
                  <Badge className="bg-blue-500/20 text-blue-300 text-xs border-0">
                    <ShieldCheck className="h-3 w-3 mr-1" />
                    Verified
                  </Badge>
                )}
              </div>
              <DialogDescription className="mt-1 text-sm">
                {agent.description}
              </DialogDescription>
              <div className="flex items-center gap-4 mt-3 text-sm">
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                  <span className="font-medium">{agent.avgRating}</span>
                  <span className="text-muted-foreground">
                    ({agent.totalReviews} reviews)
                  </span>
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Download className="h-4 w-4" />
                  {agent.installCount.toLocaleString()} installs
                </span>
                <Badge variant="outline" className="text-xs glass capitalize">
                  {agent.category.replace("_", " ")}
                </Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Capabilities */}
        {agent.capabilities && agent.capabilities.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-semibold mb-2">Capabilities</h4>
            <div className="flex flex-wrap gap-2">
              {agent.capabilities.map((cap) => (
                <Badge
                  key={cap}
                  className="bg-purple-500/15 text-purple-300 text-xs border-purple-500/20"
                >
                  {cap}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {agent.tags && agent.tags.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-semibold mb-2">Tags</h4>
            <div className="flex flex-wrap gap-2">
              {agent.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="text-xs glass"
                >
                  <Tag className="h-3 w-3 mr-1" />
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Rating Distribution */}
        {agent.ratingDistribution && (
          <div className="mt-5">
            <h4 className="text-sm font-semibold mb-3">Rating Distribution</h4>
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = agent.ratingDistribution[star - 1] || 0;
                const total = agent.ratingDistribution.reduce((a, b) => a + b, 0) || 1;
                const pct = (count / total) * 100;
                return (
                  <div key={star} className="flex items-center gap-2 text-xs">
                    <span className="w-3 text-right">{star}</span>
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className="h-full bg-amber-400 rounded-full"
                        initial={{ width: 0 }}
                        whileInView={{ width: `${pct}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                      />
                    </div>
                    <span className="w-8 text-right text-muted-foreground">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Reviews */}
        <div className="mt-5">
          <h4 className="text-sm font-semibold mb-3">
            Reviews ({totalReviews})
          </h4>
          {reviewsLoading && reviews.length === 0 ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
            </div>
          ) : reviews.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              No reviews yet. Be the first to review this agent!
            </p>
          ) : (
            <div className="space-y-3">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/10"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{review.userName}</span>
                      <StarRating rating={review.rating} />
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {review.title && (
                    <p className="text-sm font-medium mt-1">{review.title}</p>
                  )}
                  {review.body && (
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {review.body}
                    </p>
                  )}
                </div>
              ))}
              {totalReviews > reviews.length && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => {
                    const next = reviewPage + 1;
                    setReviewPage(next);
                    fetchReviews(next);
                  }}
                >
                  Load more reviews
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Install / Buy action */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-purple-500/10">
          <div className="text-xl font-bold">
            {agent.price === 0 ? (
              <span className="text-green-400">FREE</span>
            ) : (
              <span>${agent.price}</span>
            )}
          </div>
          {isInstalled ? (
            <Button
              variant="outline"
              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
              onClick={onUninstall}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove from Workspace
            </Button>
          ) : (
            <Button className="btn-gradient text-white" onClick={onInstall}>
              <Download className="h-4 w-4 mr-2" />
              {agent.price === 0 ? "Install Agent" : "Buy Agent"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReviewDialog({
  agent,
  open,
  onClose,
  onSubmit,
}: {
  agent: MarketplaceAgent | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (rating: number, title: string, body: string) => void;
}) {
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setRating(0);
      setTitle("");
      setBody("");
    }
  }, [open]);

  const handleSubmit = () => {
    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }
    setSubmitting(true);
    onSubmit(rating, title, body);
    setSubmitting(false);
    onClose();
    toast.success("Review submitted!");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="glass border-purple-500/20 max-w-md">
        <DialogHeader>
          <DialogTitle>Review {agent?.name}</DialogTitle>
          <DialogDescription>
            Share your experience with this agent
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Your Rating</label>
            <StarRating
              rating={rating}
              size="lg"
              interactive
              onChange={setRating}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Title (optional)</label>
            <Input
              placeholder="Summarize your experience"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className="bg-purple-500/5 border-purple-500/20"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">
              Review (optional)
            </label>
            <Textarea
              placeholder="What did you like or dislike?"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={2000}
              rows={3}
              className="bg-purple-500/5 border-purple-500/20"
            />
          </div>

          <Button
            className="w-full btn-gradient text-white"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Star className="h-4 w-4 mr-2" />
            )}
            Submit Review
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateAgentDialog({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [capabilities, setCapabilities] = useState("");
  const [tags, setTags] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setCategory("general");
      setSystemPrompt("");
      setCapabilities("");
      setTags("");
    }
  }, [open]);

  const handleSubmit = () => {
    if (!name.trim() || !description.trim() || !systemPrompt.trim()) {
      toast.error("Name, description, and system prompt are required");
      return;
    }
    setSubmitting(true);
    fetch("/api/marketplace/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim(),
        category,
        systemPrompt: systemPrompt.trim(),
        capabilities: capabilities
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          toast.success("Agent published to marketplace!");
          onClose();
          onSuccess();
        } else {
          toast.error(data.error || "Failed to create agent");
        }
      })
      .catch(() => toast.error("Failed to create agent"))
      .finally(() => setSubmitting(false));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="glass border-purple-500/20 max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-400" />
            Publish New Agent
          </DialogTitle>
          <DialogDescription>
            Create and share an AI agent with the Mianx.ai community
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Agent Name *</label>
            <Input
              placeholder="e.g., Data Analyst Pro"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              className="bg-purple-500/5 border-purple-500/20"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Description *</label>
            <Textarea
              placeholder="What does this agent do?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={2}
              className="bg-purple-500/5 border-purple-500/20"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.filter((c) => c.id !== "all").map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    category === cat.id
                      ? "btn-gradient text-white"
                      : "glass hover:bg-purple-500/10"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">
              System Prompt *
            </label>
            <Textarea
              placeholder="You are a helpful AI assistant that..."
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              maxLength={8000}
              rows={5}
              className="bg-purple-500/5 border-purple-500/20 font-mono text-xs"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">
              Capabilities (comma-separated)
            </label>
            <Input
              placeholder="e.g., Data analysis, Report generation, Charts"
              value={capabilities}
              onChange={(e) => setCapabilities(e.target.value)}
              className="bg-purple-500/5 border-purple-500/20"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">
              Tags (comma-separated)
            </label>
            <Input
              placeholder="e.g., analytics, data, business"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="bg-purple-500/5 border-purple-500/20"
            />
          </div>

          <Button
            className="w-full btn-gradient text-white"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Publish Agent
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ShimmerCard() {
  return (
    <Card className="glass border-purple-500/10 p-5 h-full flex flex-col">
      <div className="flex items-start gap-3 mb-3">
        <div className="h-12 w-12 rounded-xl bg-muted animate-pulse" />
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
      <div className="mt-auto pt-3 border-t border-purple-500/10 flex justify-between">
        <div className="h-5 w-12 rounded bg-muted animate-pulse" />
        <div className="h-7 w-20 rounded bg-muted animate-pulse" />
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────
//  Main Marketplace Component
// ─────────────────────────────────────────────

export function MarketplaceView() {
  const { setAuthModal } = useApp();
  const { data: session } = useSession();

  // State
  const [agents, setAgents] = useState<MarketplaceAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("popular");
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"discover" | "installed">("discover");
  const [installedAgents, setInstalledAgents] = useState<MarketplaceAgent[]>([]);
  const [installedLoading, setInstalledLoading] = useState(false);

  // Featured data
  const [stats, setStats] = useState<MarketplaceStats | null>(null);
  const [featuredAgents, setFeaturedAgents] = useState<MarketplaceAgent[]>([]);

  // Detail dialog
  const [selectedAgent, setSelectedAgent] = useState<AgentDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Review dialog
  const [reviewAgent, setReviewAgent] = useState<MarketplaceAgent | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);

  // ─── Fetch agents ───
  const fetchAgents = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (category !== "all") params.set("category", category);

    fetch(`/api/marketplace/agents?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.agents) {
          setAgents(data.agents);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [category]);

  // ─── Fetch installed agents ───
  const fetchInstalled = useCallback(() => {
    if (!session?.user?.id) return;
    setInstalledLoading(true);
    fetch("/api/marketplace/installed")
      .then((r) => r.json())
      .then((data) => {
        if (data.installed) {
          setInstalledAgents(data.installed);
          setInstalledIds(new Set(data.installed.map((a: MarketplaceAgent) => a.id)));
        }
      })
      .catch(() => {})
      .finally(() => setInstalledLoading(false));
  }, [session?.user?.id]);

  // ─── Fetch stats + featured ───
  useEffect(() => {
    fetch("/api/marketplace/stats")
      .then((r) => r.json())
      .then((data) => {
        if (data.totalAgents) setStats(data);
      })
      .catch(() => {});

    fetch("/api/marketplace/featured")
      .then((r) => r.json())
      .then((data) => {
        if (data.featured) setFeaturedAgents(data.featured);
      })
      .catch(() => {});
  }, []);

  // ─── Fetch agents on category change ───
  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // ─── Fetch installed on mount ───
  useEffect(() => {
    fetchInstalled();
  }, [fetchInstalled]);

  // ─── Filter + Sort ───
  const filtered = agents
    .filter(
      (a) =>
        !search ||
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.description.toLowerCase().includes(search.toLowerCase()) ||
        (a.tags || []).some((t) => t.toLowerCase().includes(search.toLowerCase())),
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "popular":
          return b.downloadCount - a.downloadCount;
        case "newest":
          return (b.createdAt || "").localeCompare(a.createdAt || "");
        case "rating":
          return b.rating - a.rating;
        case "free":
          return (a.price === 0 ? -1 : 1) - (b.price === 0 ? -1 : 1);
        default:
          return 0;
      }
    });

  // ─── Install handler ───
  const handleInstall = (id: string) => {
    fetch(`/api/marketplace/agents/${id}/install`, { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (data.installed) {
          setInstalledIds((prev) => new Set([...prev, id]));
          fetchAgents(); // refresh download count
          toast.success("Agent installed!");
        } else {
          toast.error(data.error || "Failed to install");
        }
      })
      .catch(() => toast.error("Failed to install agent"));
  };

  // ─── Uninstall handler ───
  const handleUninstall = (id: string) => {
    fetch(`/api/marketplace/agents/${id}/install`, { method: "DELETE" })
      .then((r) => r.json())
      .then((data) => {
        if (data.uninstalled) {
          setInstalledIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          fetchInstalled();
          toast.success("Agent removed");
        }
      })
      .catch(() => toast.error("Failed to remove agent"));
  };

  // ─── View detail ───
  const handleViewDetail = (id: string) => {
    fetch(`/api/marketplace/agents/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.agent) {
          setSelectedAgent(data.agent);
          setDetailOpen(true);
        }
      })
      .catch(() => toast.error("Failed to load agent details"));
  };

  // ─── Submit review ───
  const handleSubmitReview = (rating: number, title: string, body: string) => {
    if (!reviewAgent) return;
    fetch(`/api/marketplace/agents/${reviewAgent.id}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, title, body }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          toast.success("Review submitted!");
        } else {
          toast.error(data.error || "Failed to submit review");
        }
      })
      .catch(() => toast.error("Failed to submit review"));
  };

  return (
    <div className="relative min-h-screen pt-24 pb-20">
      <div className="fixed inset-0 mesh-bg-soft -z-10" />

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* ─── Hero ─── */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 mb-4 text-xs">
            <Bot className="h-4 w-4 text-purple-400" />
            <span className="text-muted-foreground">AI Agent Marketplace</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold">
            Discover & Install{" "}
            <span className="gradient-text">AI Agents</span>
          </h1>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto text-sm leading-relaxed">
            Browse community-built AI agents for legal, finance, health, education,
            and more. Install them to your workspace with one click.
          </p>

          {/* Stats pills */}
          {stats && (
            <div className="flex flex-wrap justify-center gap-3 mt-6">
              {[
                { label: "Agents", value: stats.totalAgents, icon: Bot },
                { label: "Installs", value: stats.totalInstalls, icon: Download },
                { label: "Reviews", value: stats.totalReviews, icon: Star },
                { label: "Verified", value: stats.verifiedCount, icon: ShieldCheck },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs"
                >
                  <stat.icon className="h-3.5 w-3.5 text-purple-400" />
                  <span className="font-semibold text-foreground">
                    {stat.value.toLocaleString()}
                  </span>
                  <span className="text-muted-foreground">{stat.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── Tab Navigation ─── */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-1 p-1 rounded-lg glass">
            <button
              onClick={() => setActiveTab("discover")}
              className={`px-4 py-2 rounded-md text-xs font-medium transition-colors ${
                activeTab === "discover"
                  ? "bg-purple-500/20 text-purple-300"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5 mr-1.5 inline" />
              Discover
            </button>
            <button
              onClick={() => setActiveTab("installed")}
              className={`px-4 py-2 rounded-md text-xs font-medium transition-colors ${
                activeTab === "installed"
                  ? "bg-purple-500/20 text-purple-300"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Package className="h-3.5 w-3.5 mr-1.5 inline" />
              My Agents
              {installedIds.size > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px]">
                  {installedIds.size}
                </span>
              )}
            </button>
          </div>

          <Button
            size="sm"
            className="btn-gradient text-white h-8"
            onClick={() => {
              if (!session?.user?.id) {
                setAuthModal("login");
                return;
              }
              setCreateOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Publish Agent
          </Button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "discover" ? (
            <motion.div
              key="discover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* ─── Featured Agents ─── */}
              {featuredAgents.length > 0 && category === "all" && !search && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="h-4 w-4 text-amber-400" />
                    <h2 className="text-sm font-semibold">Featured Agents</h2>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {featuredAgents.slice(0, 6).map((agent) => (
                      <motion.button
                        key={agent.id}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleViewDetail(agent.id)}
                        className="text-left"
                      >
                        <div className="p-3 rounded-xl glass border-purple-500/10 hover:border-purple-500/30 transition-colors">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${agent.color} mb-2`}
                          >
                            <Bot className="h-5 w-5 text-white" />
                          </div>
                          <p className="text-xs font-medium truncate">{agent.name}</p>
                          <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                            <Star className="h-2.5 w-2.5 text-amber-400 fill-amber-400" />
                            <span>{agent.rating}</span>
                            <span className="ml-1">
                              {agent.downloadCount} installs
                            </span>
                          </div>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {/* ─── Category Icons ─── */}
              {category === "all" && !search && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <Tag className="h-4 w-4 text-purple-400" />
                    <h2 className="text-sm font-semibold">Browse by Category</h2>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                    {CATEGORIES.filter((c) => c.id !== "all").map((cat) => {
                      const count =
                        stats?.categories.find((c) => c.name === cat.id)?.count || 0;
                      return (
                        <motion.button
                          key={cat.id}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setCategory(cat.id)}
                          className="flex flex-col items-center gap-2 p-3 rounded-xl glass border-purple-500/10 hover:border-purple-500/30 transition-colors"
                        >
                          <cat.icon className="h-5 w-5 text-purple-400" />
                          <span className="text-[10px] font-medium">{cat.label}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {count}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ─── Search + Sort + Filters ─── */}
              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search agents, tags, capabilities..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-lg glass border-purple-500/10 bg-transparent text-sm focus:outline-none focus:border-purple-500/30"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="pl-8 pr-3 py-2 rounded-lg glass border-purple-500/10 bg-transparent text-xs appearance-none cursor-pointer focus:outline-none"
                    >
                      {SORT_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {category !== "all" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-9"
                      onClick={() => setCategory("all")}
                    >
                      Clear Filter
                    </Button>
                  )}
                </div>
              </div>

              {/* Category quick-filter (horizontal scroll) */}
              <div className="flex gap-2 overflow-x-auto no-scrollbar mb-6">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCategory(cat.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                      category === cat.id
                        ? "btn-gradient text-white"
                        : "glass hover:bg-purple-500/10"
                    }`}
                  >
                    <cat.icon className="h-3 w-3" />
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* ─── Agents Grid ─── */}
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <ShimmerCard key={i} />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <Card className="glass border-purple-500/10 p-12 text-center">
                  <Bot className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                  <h3 className="font-semibold text-lg mb-2">No agents found</h3>
                  <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                    {search
                      ? `No agents match "${search}". Try different keywords.`
                      : "No agents in this category yet."}
                  </p>
                  <Button
                    className="btn-gradient text-white"
                    onClick={() => {
                      setCreateOpen(true);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create Agent
                  </Button>
                </Card>
              ) : (
                <>
                  <div className="text-xs text-muted-foreground mb-3">
                    {filtered.length} agent{filtered.length !== 1 ? "s" : ""} found
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map((agent) => (
                      <AgentCard
                        key={agent.id}
                        agent={agent}
                        isInstalled={installedIds.has(agent.id)}
                        onViewDetail={handleViewDetail}
                        onInstall={handleInstall}
                        onUninstall={handleUninstall}
                      />
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="installed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* ─── My Installed Agents ─── */}
              {!session?.user?.id ? (
                <Card className="glass border-purple-500/10 p-12 text-center">
                  <Package className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                  <h3 className="font-semibold text-lg mb-2">Sign in Required</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Sign in to view and manage your installed agents.
                  </p>
                  <Button
                    className="btn-gradient text-white"
                    onClick={() => setAuthModal("login")}
                  >
                    Sign In
                  </Button>
                </Card>
              ) : installedLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
                </div>
              ) : installedAgents.length === 0 ? (
                <Card className="glass border-purple-500/10 p-12 text-center">
                  <Package className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                  <h3 className="font-semibold text-lg mb-2">No Agents Installed</h3>
                  <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                    Install agents from the marketplace to use them in your
                    missions and projects.
                  </p>
                  <Button
                    className="btn-gradient text-white"
                    onClick={() => setActiveTab("discover")}
                  >
                    Browse Marketplace
                  </Button>
                </Card>
              ) : (
                <>
                  <div className="text-xs text-muted-foreground mb-3">
                    {installedAgents.length} agent
                    {installedAgents.length !== 1 ? "s" : ""} installed
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {installedAgents.map((agent) => (
                      <AgentCard
                        key={agent.id}
                        agent={agent}
                        isInstalled={true}
                        onViewDetail={handleViewDetail}
                        onInstall={handleInstall}
                        onUninstall={handleUninstall}
                      />
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── Dialogs ─── */}
      <AgentDetailDialog
        agent={selectedAgent}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        isInstalled={selectedAgent ? installedIds.has(selectedAgent.id) : false}
        onInstall={() => {
          if (selectedAgent) handleInstall(selectedAgent.id);
        }}
        onUninstall={() => {
          if (selectedAgent) handleUninstall(selectedAgent.id);
        }}
      />

      <ReviewDialog
        agent={reviewAgent}
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        onSubmit={handleSubmitReview}
      />

      <CreateAgentDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={fetchAgents}
      />
    </div>
  );
}
