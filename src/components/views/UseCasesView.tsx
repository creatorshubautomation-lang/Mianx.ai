"use client";

import { useApp } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  ShoppingCart,
  Heart,
  Plane,
  Dumbbell,
  BookOpen,
  Building,
  Factory,
  Music,
  ArrowRight,
} from "lucide-react";

export function UseCasesView() {
  const { setAuthModal } = useApp();

  const useCases = [
    {
      icon: ShoppingCart,
      title: "E-Commerce Platforms",
      industry: "Retail",
      desc: "Full e-commerce sites with product catalogs, cart, checkout, and admin panel — built by dev agents, branded by design agents, copy by content agents.",
      deliverables: ["Next.js storefront", "Admin dashboard", "Brand identity", "Product copy"],
      color: "from-pink-500 to-rose-500",
    },
    {
      icon: Heart,
      title: "Healthtech Apps",
      industry: "Healthcare",
      desc: "HIPAA-compliant patient portals, telemedicine interfaces, and health tracking apps with proper security reviews by our QA agents.",
      deliverables: ["Patient portal", "Booking system", "Security audit", "API documentation"],
      color: "from-red-500 to-rose-500",
    },
    {
      icon: Plane,
      title: "Travel & Booking",
      industry: "Travel",
      desc: "Booking platforms, itinerary planners, and travel content sites with multilingual support and integrated payment flows.",
      deliverables: ["Booking engine", "Itinerary UI", "SEO content", "Multi-language"],
      color: "from-cyan-500 to-blue-500",
    },
    {
      icon: Dumbbell,
      title: "Fitness & Wellness",
      industry: "Health & Fitness",
      desc: "Workout trackers, meal planners, and wellness coaching apps with beautiful UIs and engaging content.",
      deliverables: ["Mobile-first PWA", "Workout database", "Content library", "Social features"],
      color: "from-emerald-500 to-green-500",
    },
    {
      icon: BookOpen,
      title: "EdTech Platforms",
      industry: "Education",
      desc: "Learning management systems, course platforms, and educational content hubs with quizzes and progress tracking.",
      deliverables: ["LMS dashboard", "Course pages", "Quiz engine", "Student analytics"],
      color: "from-amber-500 to-yellow-500",
    },
    {
      icon: Building,
      title: "SaaS MVPs",
      industry: "Startups",
      desc: "From idea to MVP in days, not months. Auth, billing, dashboards, and APIs — all production-ready and investor-pitchable.",
      deliverables: ["SaaS boilerplate", "Auth & billing", "Admin panel", "API docs"],
      color: "from-violet-500 to-purple-500",
    },
    {
      icon: Factory,
      title: "Internal Tools",
      industry: "Enterprise",
      desc: "Custom CRMs, inventory systems, and workflow automation tools that replace spreadsheets and manual processes.",
      deliverables: ["Custom CRM", "Workflow engine", "Reports", "Role-based access"],
      color: "from-orange-500 to-amber-500",
    },
    {
      icon: Music,
      title: "Media & Content",
      industry: "Media",
      desc: "Content platforms, podcast sites, and creator tools with CMS, monetization, and audience engagement features.",
      deliverables: ["CMS platform", "Podcast player", "Monetization", "Newsletter"],
      color: "from-fuchsia-500 to-pink-500",
    },
  ];

  return (
    <div className="relative min-h-screen pt-24 pb-20">
      <div className="fixed inset-0 mesh-bg-soft -z-10" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold">
            What teams <span className="gradient-text">build with Mianx.ai</span>
          </h1>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            From MVPs to enterprise platforms — real projects delivered by AI agent teams across industries.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {useCases.map((uc, i) => (
            <motion.div
              key={uc.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="glass border-purple-500/10 p-6 h-full card-hover">
                <div
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br ${uc.color} mb-4`}
                >
                  <uc.icon className="h-5 w-5 text-white" />
                </div>
                <Badge variant="outline" className="text-xs mb-2 glass">
                  {uc.industry}
                </Badge>
                <h3 className="font-semibold text-lg mb-2">{uc.title}</h3>
                <p className="text-sm text-muted-foreground mb-4">{uc.desc}</p>
                <div className="space-y-1">
                  {uc.deliverables.map((d) => (
                    <div key={d} className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span className="h-1 w-1 rounded-full bg-purple-400" />
                      {d}
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        <Card className="glass-strong border-purple-500/20 p-10 text-center mt-12">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">
            Don&apos;t see your industry?
          </h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Our agents adapt to any domain. Describe your project and they&apos;ll figure out the right approach.
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
    </div>
  );
}
