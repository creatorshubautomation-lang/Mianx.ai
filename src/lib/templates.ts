// Mianx.ai — Project Templates Marketplace
// Pre-built project templates that clients can use to start instantly

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
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
  | "social";

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
];
