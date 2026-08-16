// Mianx.ai — Project Templates Marketplace
// Pre-built project templates that clients can use to start instantly

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory | "landing" | "agency" | "ai_tool" | "community" | "custom";
  icon: string;
  color: string;
  popularity: number; // 1-100
  isPremium: boolean;
  requiredAgents: string[]; // agent names
  estimatedDays: number;
  features: string[];
  techStack: string[];
  previewImage?: string;
  defaultProjectType: string;
  defaultDescription: string;
  // Phase 11: Mission-ready config
  missionObjective?: string; // pre-built mission brief
  suggestedTools?: string[];   // tools needed
  difficulty?: "beginner" | "intermediate" | "advanced";
}

export type TemplateCategory =
  | "ecommerce"
  | "portfolio"
  | "saas"
  | "blog"
  | "restaurant"
  | "realestate"
  | "education"
  | "healthcare"
  | "finance"
  | "social"
  | "landing"
  | "agency"
  | "ai_tool"
  | "community"
  | "custom";

export const TEMPLATES: ProjectTemplate[] = [
  // 1. E-Commerce Platform
  {
    id: "ecommerce-fashion",
    name: "Fashion E-Commerce Store",
    description:
      "Complete online store with product catalog, cart, checkout, and admin panel. Mobile-first, SEO optimized.",
    category: "ecommerce",
    icon: "ShoppingBag",
    color: "from-pink-500 to-rose-500",
    popularity: 95,
    isPremium: false,
    requiredAgents: ["Aria", "Kairo", "Zen", "Atlas", "Vega", "Lyra", "Sage", "Shield"],
    estimatedDays: 3,
    features: [
      "Product catalog with categories",
      "Shopping cart + wishlist",
      "Stripe checkout integration",
      "User authentication",
      "Admin dashboard",
      "Order management",
      "SEO optimization",
      "Mobile responsive",
    ],
    techStack: ["Next.js", "TypeScript", "Prisma", "Stripe", "Tailwind"],
    defaultProjectType: "web",
    defaultDescription:
      "Build a modern fashion e-commerce store with product catalog, shopping cart, Stripe checkout, user accounts, and admin dashboard. Should be mobile-first and SEO optimized.",
    difficulty: "advanced",
    missionObjective:
      "Build a complete fashion e-commerce platform with product catalog, shopping cart, Stripe checkout, user accounts, order management, and admin dashboard. Mobile-first, SEO optimized.",
    suggestedTools: ["file_write", "code_verify", "web_search"],
  },

  // 2. Portfolio Website
  {
    id: "portfolio-creative",
    name: "Creative Portfolio",
    description:
      "Stunning portfolio website for designers, photographers, or freelancers. Smooth animations, project showcase.",
    category: "portfolio",
    icon: "Palette",
    color: "from-violet-500 to-purple-500",
    popularity: 88,
    isPremium: false,
    requiredAgents: ["Aria", "Kairo", "Nova", "Zen", "Lyra"],
    estimatedDays: 2,
    features: [
      "Hero section with animations",
      "Project gallery",
      "About + skills section",
      "Contact form",
      "Blog (optional)",
      "Dark mode",
      "SEO ready",
    ],
    techStack: ["Next.js", "Framer Motion", "Tailwind"],
    defaultProjectType: "web",
    defaultDescription:
      "Create a stunning creative portfolio website with smooth animations, project gallery, about section, contact form, and dark mode support.",
    difficulty: "beginner",
    missionObjective:
      "Create a stunning creative portfolio with smooth Framer Motion animations, project gallery with filtering, about section, contact form, and dark mode.",
    suggestedTools: ["file_write", "code_verify"],
  },

  // 3. SaaS MVP
  {
    id: "saas-mvp",
    name: "SaaS MVP Starter",
    description:
      "Production-ready SaaS boilerplate with auth, billing, dashboard, and API. Pitch-ready for investors.",
    category: "saas",
    icon: "Rocket",
    color: "from-cyan-500 to-blue-500",
    popularity: 92,
    isPremium: true,
    requiredAgents: ["Aria", "Kairo", "Zen", "Atlas", "Vega", "Orion", "Shield", "Cipher", "Lyra", "Sage"],
    estimatedDays: 5,
    features: [
      "User authentication (NextAuth)",
      "Subscription billing (Stripe)",
      "Admin dashboard",
      "User dashboard",
      "API with rate limiting",
      "Email notifications",
      "Analytics tracking",
      "Deployment ready",
    ],
    techStack: ["Next.js", "TypeScript", "Prisma", "Stripe", "NextAuth", "Resend"],
    defaultProjectType: "fullstack",
    defaultDescription:
      "Build a production-ready SaaS MVP with authentication, subscription billing, admin + user dashboards, API, email notifications, and analytics. Should be investor-pitch ready.",
    difficulty: "advanced",
    missionObjective:
      "Build a production-ready SaaS MVP with NextAuth authentication, Stripe subscription billing, admin + user dashboards, API with rate limiting, email notifications, and analytics. Investor-pitch ready.",
    suggestedTools: ["file_write", "code_verify", "web_search", "api_call"],
  },

  // 4. Blog Platform
  {
    id: "blog-platform",
    name: "Modern Blog Platform",
    description:
      "Full-featured blog with MDX support, categories, search, and CMS-like admin panel.",
    category: "blog",
    icon: "FileText",
    color: "from-amber-500 to-yellow-500",
    popularity: 75,
    isPremium: false,
    requiredAgents: ["Kairo", "Zen", "Atlas", "Echo", "Sage"],
    estimatedDays: 2,
    features: [
      "MDX blog posts",
      "Categories + tags",
      "Search functionality",
      "Admin writing panel",
      "Comments system",
      "RSS feed",
      "SEO optimized",
    ],
    techStack: ["Next.js", "MDX", "Prisma", "Tailwind"],
    defaultProjectType: "web",
    defaultDescription:
      "Create a modern blog platform with MDX support, categories, tags, search, admin writing panel, comments, RSS feed, and SEO optimization.",
    difficulty: "beginner",
    missionObjective:
      "Create a modern blog with MDX support, category/tag system, full-text search, admin writing panel, comments, RSS feed, and SEO optimization.",
    suggestedTools: ["file_write", "code_verify"],
  },

  // 5. Restaurant Website
  {
    id: "restaurant-website",
    name: "Restaurant Website + Ordering",
    description:
      "Beautiful restaurant website with online menu, table booking, and online ordering system.",
    category: "restaurant",
    icon: "UtensilsCrossed",
    color: "from-orange-500 to-red-500",
    popularity: 82,
    isPremium: false,
    requiredAgents: ["Aria", "Kairo", "Zen", "Atlas", "Lyra", "Echo"],
    estimatedDays: 3,
    features: [
      "Menu with categories",
      "Online ordering system",
      "Table reservation",
      "Photo gallery",
      "Location + hours",
      "Contact form",
      "Reviews section",
    ],
    techStack: ["Next.js", "Prisma", "Tailwind"],
    defaultProjectType: "web",
    defaultDescription:
      "Build a restaurant website with online menu, ordering system, table reservation, photo gallery, location/hours, and contact form.",
    difficulty: "intermediate",
    missionObjective:
      "Build a restaurant website with online menu, ordering system, table reservation, photo gallery, location/hours, reviews section, and contact form.",
    suggestedTools: ["file_write", "code_verify", "web_search"],
  },

  // 6. Real Estate Platform
  {
    id: "realestate-platform",
    name: "Real Estate Listing Platform",
    description:
      "Property listing platform with search, filters, map integration, and agent dashboard.",
    category: "realestate",
    icon: "Building2",
    color: "from-emerald-500 to-teal-500",
    popularity: 78,
    isPremium: true,
    requiredAgents: ["Aria", "Kairo", "Zen", "Atlas", "Vega", "Lyra", "Sage"],
    estimatedDays: 4,
    features: [
      "Property listings",
      "Advanced search + filters",
      "Map integration",
      "Agent dashboard",
      "Mortgage calculator",
      "Saved favorites",
      "Contact agent",
      "Photo gallery",
    ],
    techStack: ["Next.js", "Prisma", "Mapbox", "Tailwind"],
    defaultProjectType: "web",
    defaultDescription:
      "Create a real estate platform with property listings, advanced search, map integration, agent dashboard, mortgage calculator, and favorites.",
    difficulty: "advanced",
    missionObjective:
      "Build a real estate platform with property listings, advanced search filters, map integration, agent dashboard, mortgage calculator, favorites, and contact system.",
    suggestedTools: ["file_write", "code_verify", "web_search"],
  },

  // 7. Online Course Platform
  {
    id: "education-lms",
    name: "Online Course Platform (LMS)",
    description:
      "Learning management system with video courses, quizzes, progress tracking, and certificates.",
    category: "education",
    icon: "GraduationCap",
    color: "from-blue-500 to-indigo-500",
    popularity: 85,
    isPremium: true,
    requiredAgents: ["Aria", "Kairo", "Zen", "Atlas", "Vega", "Lyra", "Echo", "Sage", "Shield"],
    estimatedDays: 5,
    features: [
      "Video course player",
      "Quizzes + assignments",
      "Progress tracking",
      "Certificates",
      "Student dashboard",
      "Instructor panel",
      "Discussion forum",
      "Payment integration",
    ],
    techStack: ["Next.js", "Prisma", "Stripe", "Mux", "Tailwind"],
    defaultProjectType: "fullstack",
    defaultDescription:
      "Build a learning management system with video courses, quizzes, progress tracking, certificates, student/instructor dashboards, and payment integration.",
    difficulty: "advanced",
    missionObjective:
      "Build an LMS with video courses, quizzes, progress tracking, certificates, student/instructor dashboards, discussion forum, and payment integration.",
    suggestedTools: ["file_write", "code_verify", "web_search", "api_call"],
  },

  // 8. Healthcare Portal
  {
    id: "healthcare-portal",
    name: "Healthcare Patient Portal",
    description:
      "HIPAA-compliant patient portal with appointment booking, records, and telemedicine.",
    category: "healthcare",
    icon: "HeartPulse",
    color: "from-red-500 to-rose-500",
    popularity: 70,
    isPremium: true,
    requiredAgents: ["Aria", "Kairo", "Zen", "Atlas", "Vega", "Cipher", "Shield", "Lens"],
    estimatedDays: 6,
    features: [
      "Patient authentication",
      "Appointment booking",
      "Medical records",
      "Prescriptions",
      "Telemedicine (video)",
      "Secure messaging",
      "Health tracking",
      "HIPAA compliance",
    ],
    techStack: ["Next.js", "Prisma", "WebRTC", "Tailwind"],
    defaultProjectType: "fullstack",
    defaultDescription:
      "Create a HIPAA-compliant healthcare patient portal with appointment booking, medical records, prescriptions, telemedicine, and secure messaging.",
    difficulty: "advanced",
    missionObjective:
      "Create a HIPAA-compliant healthcare portal with appointment booking, medical records, prescriptions, telemedicine video calls, and secure messaging.",
    suggestedTools: ["file_write", "code_verify", "web_search"],
  },

  // 9. Finance Dashboard
  {
    id: "finance-dashboard",
    name: "Personal Finance Dashboard",
    description:
      "Finance tracker with budgeting, expense tracking, charts, and goal setting.",
    category: "finance",
    icon: "TrendingUp",
    color: "from-green-500 to-emerald-500",
    popularity: 80,
    isPremium: false,
    requiredAgents: ["Kairo", "Zen", "Atlas", "Vega", "Insight"],
    estimatedDays: 3,
    features: [
      "Expense tracking",
      "Budget management",
      "Financial charts",
      "Goal setting",
      "Category management",
      "CSV import",
      "Recurring transactions",
      "Reports",
    ],
    techStack: ["Next.js", "Prisma", "Recharts", "Tailwind"],
    defaultProjectType: "web",
    defaultDescription:
      "Build a personal finance dashboard with expense tracking, budget management, charts, goal setting, and reports.",
    difficulty: "intermediate",
    missionObjective:
      "Build a personal finance dashboard with expense tracking, budget management, interactive charts, goal setting, category management, CSV import, and reports.",
    suggestedTools: ["file_write", "code_verify"],
  },

  // 10. Social Media App
  {
    id: "social-platform",
    name: "Social Media Platform",
    description:
      "Social network with posts, likes, comments, follow system, and real-time notifications.",
    category: "social",
    icon: "Users",
    color: "from-fuchsia-500 to-pink-500",
    popularity: 87,
    isPremium: true,
    requiredAgents: ["Aria", "Kairo", "Zen", "Atlas", "Vega", "Orion", "Lyra", "Pulse", "Shield"],
    estimatedDays: 5,
    features: [
      "User profiles",
      "Posts + media",
      "Likes + comments",
      "Follow system",
      "Real-time notifications",
      "Direct messaging",
      "News feed",
      "Search + discover",
    ],
    techStack: ["Next.js", "Prisma", "WebSockets", "Tailwind"],
    defaultProjectType: "fullstack",
    defaultDescription:
      "Create a social media platform with user profiles, posts, likes, comments, follow system, real-time notifications, and direct messaging.",
    difficulty: "advanced",
    missionObjective:
      "Build a complete social media platform with user authentication, post feed, likes/comments, follow system, real-time notifications via SSE, and direct messaging. Include an admin panel for content moderation.",
    suggestedTools: ["file_write", "code_verify", "web_search"],
  },

  // 11. Landing Page Builder
  {
    id: "landing-page",
    name: "High-Converting Landing Page",
    description:
      "Beautiful, conversion-optimized landing page with hero, features, testimonials, pricing, and CTA sections. Perfect for product launches.",
    category: "landing",
    icon: "Sparkles",
    color: "from-indigo-500 to-violet-500",
    popularity: 90,
    isPremium: false,
    requiredAgents: ["Aria", "Kairo", "Zen", "Lyra", "Sage"],
    estimatedDays: 1,
    features: [
      "Hero section with CTA",
      "Feature highlights",
      "Testimonials carousel",
      "Pricing table",
      "FAQ section",
      "Contact form",
      "SEO optimization",
      "A/B ready sections",
    ],
    techStack: ["Next.js", "Framer Motion", "Tailwind"],
    defaultProjectType: "web",
    defaultDescription:
      "Build a high-converting landing page with hero section, features, testimonials, pricing, FAQ, and contact form. Optimized for conversions and SEO.",
    difficulty: "beginner",
    missionObjective:
      "Create a stunning, mobile-responsive landing page with hero, features grid, testimonials, pricing table, FAQ accordion, and contact form. Focus on conversion optimization and page speed.",
    suggestedTools: ["file_write", "code_verify"],
  },

  // 12. Agency Website
  {
    id: "agency-website",
    name: "Digital Agency Website",
    description:
      "Professional agency website with portfolio showcase, team section, services, and client onboarding flow.",
    category: "agency",
    icon: "Briefcase",
    color: "from-slate-500 to-zinc-500",
    popularity: 76,
    isPremium: false,
    requiredAgents: ["Aria", "Kairo", "Zen", "Nova", "Lyra", "Sage"],
    estimatedDays: 3,
    features: [
      "Hero with video background",
      "Services showcase",
      "Portfolio gallery",
      "Team profiles",
      "Client testimonials",
      "Case studies",
      "Contact form + booking",
      "Blog/news section",
    ],
    techStack: ["Next.js", "Framer Motion", "Prisma", "Tailwind"],
    defaultProjectType: "web",
    defaultDescription:
      "Build a professional digital agency website with portfolio, team, services, case studies, and client onboarding.",
    difficulty: "intermediate",
    missionObjective:
      "Build a full digital agency website with animated hero, services cards, portfolio filter gallery, team grid, case study pages, testimonial slider, and a contact/booking form. Include a blog section.",
    suggestedTools: ["file_write", "code_verify", "web_search"],
  },

  // 13. AI Tool / Wrapper
  {
    id: "ai-tool-wrapper",
    name: "AI SaaS Tool Wrapper",
    description:
      "Wrap any AI API into a polished SaaS product with user auth, usage tracking, billing, and clean UI.",
    category: "ai_tool",
    icon: "Brain",
    color: "from-purple-500 to-fuchsia-500",
    popularity: 93,
    isPremium: true,
    requiredAgents: ["Zen", "Atlas", "Orion", "Vega", "Shield", "Cipher", "Lyra"],
    estimatedDays: 4,
    features: [
      "User authentication",
      "API key management",
      "Usage dashboard",
      "Stripe billing",
      "Rate limiting",
      "API documentation",
      "Webhook support",
      "Admin analytics",
    ],
    techStack: ["Next.js", "TypeScript", "Prisma", "Stripe", "Redis"],
    defaultProjectType: "fullstack",
    defaultDescription:
      "Build an AI SaaS wrapper that takes any AI API and turns it into a polished product with auth, billing, usage tracking, and clean dashboard UI.",
    difficulty: "advanced",
    missionObjective:
      "Build a complete AI SaaS product wrapper with Next.js frontend, Stripe billing, user auth, API key management, usage dashboard with charts, rate limiting, and admin analytics. Include API docs page.",
    suggestedTools: ["file_write", "code_verify", "web_search", "api_call"],
  },

  // 14. Community Forum
  {
    id: "community-forum",
    name: "Community Forum Platform",
    description:
      "Modern community forum with topics, threads, replies, user reputation, and moderation tools.",
    category: "community",
    icon: "MessageSquare",
    color: "from-teal-500 to-emerald-500",
    popularity: 72,
    isPremium: false,
    requiredAgents: ["Aria", "Kairo", "Zen", "Atlas", "Vega", "Lyra"],
    estimatedDays: 3,
    features: [
      "Topic categories",
      "Thread + reply system",
      "User reputation/points",
      "Rich text editor",
      "Search + filters",
      "User profiles",
      "Moderation tools",
      "Email notifications",
    ],
    techStack: ["Next.js", "Prisma", "TipTap", "Tailwind"],
    defaultProjectType: "fullstack",
    defaultDescription:
      "Build a modern community forum with categories, threads, replies, user reputation system, rich text editor, and moderation tools.",
    difficulty: "intermediate",
    missionObjective:
      "Build a community forum with topic categories, nested thread/reply system, user reputation and badges, rich text editor (TipTap), full-text search, and admin moderation panel.",
    suggestedTools: ["file_write", "code_verify", "web_search"],
  },

  // 15. Startup MVP Combo
  {
    id: "startup-mvp-combo",
    name: "Startup MVP — Landing + Auth + Dashboard",
    description:
      "The ultimate startup starter: landing page, authentication, user dashboard, and billing — all in one shot.",
    category: "saas",
    icon: "Rocket",
    color: "from-orange-500 to-amber-500",
    popularity: 97,
    isPremium: true,
    requiredAgents: ["Aria", "Kairo", "Zen", "Atlas", "Vega", "Orion", "Shield", "Cipher", "Lyra", "Sage", "Echo", "Pulse"],
    estimatedDays: 7,
    features: [
      "Conversion landing page",
      "User authentication (JWT)",
      "Email verification",
      "Subscription billing",
      "User dashboard",
      "Admin panel",
      "Analytics tracking",
      "API documentation",
      "Blog/CMS",
      "Email notifications",
      "SEO optimization",
      "Dark mode",
    ],
    techStack: ["Next.js", "TypeScript", "Prisma", "Stripe", "NextAuth", "Resend", "Recharts"],
    defaultProjectType: "fullstack",
    defaultDescription:
      "Build a complete startup MVP with landing page, auth, billing, dashboards, blog, and all the essentials needed to launch.",
    difficulty: "advanced",
    missionObjective:
      "Build the ultimate startup MVP: a high-converting landing page, NextAuth authentication with email verification, Stripe subscription billing, user and admin dashboards, blog/CMS, analytics, API docs, email notifications, and dark mode. This is a full production-ready SaaS.",
    suggestedTools: ["file_write", "code_verify", "web_search", "api_call"],
  },
];

// ─────────────────────────────────────────────
//  Helper functions
// ─────────────────────────────────────────────

export function getTemplatesByCategory(
  category: TemplateCategory,
): ProjectTemplate[] {
  return TEMPLATES.filter((t) => t.category === category);
}

export function getTemplateById(id: string): ProjectTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

export function getPopularTemplates(limit: number = 6): ProjectTemplate[] {
  return [...TEMPLATES]
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, limit);
}

export function getFreeTemplates(): ProjectTemplate[] {
  return TEMPLATES.filter((t) => !t.isPremium);
}

export function getPremiumTemplates(): ProjectTemplate[] {
  return TEMPLATES.filter((t) => t.isPremium);
}

export const CATEGORIES: {
  id: TemplateCategory;
  label: string;
  icon: string;
}[] = [
  { id: "ecommerce", label: "E-Commerce", icon: "ShoppingBag" },
  { id: "portfolio", label: "Portfolio", icon: "Palette" },
  { id: "saas", label: "SaaS", icon: "Rocket" },
  { id: "blog", label: "Blog", icon: "FileText" },
  { id: "restaurant", label: "Restaurant", icon: "UtensilsCrossed" },
  { id: "realestate", label: "Real Estate", icon: "Building2" },
  { id: "education", label: "Education", icon: "GraduationCap" },
  { id: "healthcare", label: "Healthcare", icon: "HeartPulse" },
  { id: "finance", label: "Finance", icon: "TrendingUp" },
  { id: "social", label: "Social", icon: "Users" },
  { id: "landing", label: "Landing Page", icon: "Sparkles" },
  { id: "agency", label: "Agency", icon: "Briefcase" },
  { id: "ai_tool", label: "AI Tool", icon: "Brain" },
  { id: "community", label: "Community", icon: "MessageSquare" },
  { id: "custom", label: "Custom", icon: "Plus" },
];
