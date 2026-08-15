"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Bot,
  Download,
  Star,
  Loader2,
  Search,
  Plus,
  Check,
} from "lucide-react";
import { motion } from "framer-motion";

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
}

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "general", label: "General" },
  { id: "legal", label: "Legal" },
  { id: "finance", label: "Finance" },
  { id: "health", label: "Health" },
  { id: "education", label: "Education" },
  { id: "real_estate", label: "Real Estate" },
  { id: "custom", label: "Custom" },
];

export function MarketplaceView() {
  const { setAuthModal } = useApp();
  const [agents, setAgents] = useState<MarketplaceAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let mounted = true;
    fetch(`/api/marketplace/agents${category !== "all" ? `?category=${category}` : ""}`)
      .then((r) => r.json())
      .then((data) => {
        if (mounted) {
          if (data.agents) setAgents(data.agents);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [category]);

  const filtered = agents.filter(
    (a) =>
      !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.description.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="relative min-h-screen pt-24 pb-20">
      <div className="fixed inset-0 mesh-bg-soft -z-10" />

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 mb-4 text-xs">
            <Bot className="h-3.5 w-3.5 text-purple-400" />
            <span className="text-muted-foreground">AI Agent Marketplace</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold">
            Agent <span className="gradient-text">Marketplace</span>
          </h1>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Discover and install custom AI agents built by the community. Legal advisors, financial analysts, health consultants, and more.
          </p>
        </div>

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search agents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-md glass border-purple-500/10 bg-transparent text-sm focus:outline-none focus:border-purple-500/30"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap ${
                  category === cat.id ? "btn-gradient text-white" : "glass"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Agents grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="glass border-purple-500/10 p-12 text-center">
            <Bot className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
            <h3 className="font-semibold text-lg mb-2">No agents found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Be the first to publish a custom agent on the marketplace!
            </p>
            <Button className="btn-gradient text-white">
              <Plus className="mr-2 h-4 w-4" />
              Create Agent
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((agent, i) => (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="glass border-purple-500/10 p-5 h-full flex flex-col card-hover">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br ${agent.color}`}>
                      <Bot className="h-5 w-5 text-white" />
                    </div>
                    {agent.isVerified && (
                      <Badge className="bg-blue-500/20 text-blue-300 text-xs">
                        <Check className="h-3 w-3 mr-1" />
                        Verified
                      </Badge>
                    )}
                  </div>

                  <h3 className="font-semibold mb-1">{agent.name}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                    {agent.description}
                  </p>

                  <div className="flex items-center gap-3 mb-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-amber-400" />
                      {agent.rating}
                    </span>
                    <span className="flex items-center gap-1">
                      <Download className="h-3 w-3" />
                      {agent.downloadCount}
                    </span>
                    <Badge variant="outline" className="text-xs glass">
                      {agent.category}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between mt-auto">
                    <div className="text-lg font-bold">
                      {agent.price === 0 ? (
                        <span className="text-green-400">FREE</span>
                      ) : (
                        <span>${agent.price}</span>
                      )}
                    </div>
                    <Button size="sm" className="btn-gradient text-white">
                      {agent.price === 0 ? "Install" : "Buy"}
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
