// Mianx.ai Academy — Course definitions (seed data)

export interface CourseTemplate {
  id: string;
  title: string;
  description: string;
  instructor: string;
  category: string;
  level: string;
  price: number;
  duration: number;
  isPremium: boolean;
  lessons: { title: string; description: string; duration: number; isPreview: boolean }[];
}

export const COURSES: CourseTemplate[] = [
  {
    id: "course-100-apps",
    title: "100 Business Apps with AI — No Coding Required",
    description:
      "Learn how to build 100 real business apps using Mianx.ai's AI agent team. From client portals to e-commerce stores — no coding experience needed.",
    instructor: "Mianx.ai Team",
    category: "business",
    level: "beginner",
    price: 99,
    duration: 600,
    isPremium: true,
    lessons: [
      { title: "Introduction: AI-Powered App Building", description: "Understand how AI agents can build real business apps", duration: 15, isPreview: true },
      { title: "Setting Up Your Mianx.ai Account", description: "Create account, navigate dashboard, understand agent teams", duration: 20, isPreview: true },
      { title: "Building Your First App: Client Portal", description: "Step-by-step guide to building a client portal", duration: 45, isPreview: false },
      { title: "App #2: Invoice Generator", description: "Create an invoice generator with AI", duration: 30, isPreview: false },
      { title: "App #3: Appointment Booking System", description: "Build a booking app from scratch", duration: 40, isPreview: false },
      { title: "App #4-10: CRM, Help Desk, Landing Pages", description: "Batch build 7 more business apps", duration: 90, isPreview: false },
      { title: "Customizing Apps for Clients", description: "How to white-label and customize for different clients", duration: 35, isPreview: false },
      { title: "Deploying Apps to Production", description: "Launch your apps on Vercel + custom domains", duration: 25, isPreview: false },
      { title: "Selling Apps: Pricing & Marketing", description: "How to price and sell your AI-built apps", duration: 30, isPreview: false },
      { title: "Scaling: Building 100 Apps", description: "Systematize your app building process", duration: 40, isPreview: false },
    ],
  },
  {
    id: "course-master-mianx",
    title: "Master Mianx.ai — Advanced Agent Techniques",
    description:
      "Go beyond basics. Learn multi-agent orchestration, @mentions, template creation, and advanced project management.",
    instructor: "Mianx.ai Team",
    category: "ai",
    level: "intermediate",
    price: 49,
    duration: 300,
    isPremium: true,
    lessons: [
      { title: "Multi-Agent Team Chat Deep Dive", description: "How to get 3 agents to respond in parallel", duration: 25, isPreview: true },
      { title: "Using @Mentions for Direct Agent Communication", description: "Route messages to specific agents", duration: 15, isPreview: true },
      { title: "Creating Custom Templates", description: "Build reusable project templates", duration: 30, isPreview: false },
      { title: "Agent Memory System", description: "How agents remember your preferences", duration: 20, isPreview: false },
      { title: "Webhooks & Integrations", description: "Connect Mianx.ai with external tools", duration: 35, isPreview: false },
    ],
  },
  {
    id: "course-software-house",
    title: "Build Your Own AI Software House",
    description:
      "Turn Mianx.ai into a full business. Learn client acquisition, pricing, delivery, and scaling your AI-powered agency.",
    instructor: "Mianx.ai Team",
    category: "business",
    level: "advanced",
    price: 199,
    duration: 480,
    isPremium: true,
    lessons: [
      { title: "The AI Software House Model", description: "Understanding the business model", duration: 20, isPreview: true },
      { title: "Finding Your First 10 Clients", description: "Marketing strategies for AI services", duration: 40, isPreview: false },
      { title: "Pricing Your Services", description: "How to charge $500-$5000 per project", duration: 30, isPreview: false },
      { title: "Project Delivery Workflow", description: "From client brief to delivery in 24 hours", duration: 45, isPreview: false },
      { title: "Recurring Revenue: Maintenance Plans", description: "Build monthly recurring income", duration: 35, isPreview: false },
      { title: "Hiring & Scaling", description: "When and how to expand your team", duration: 30, isPreview: false },
      { title: "White-Label: Selling to Other Agencies", description: "License Mianx.ai to other businesses", duration: 40, isPreview: false },
    ],
  },
  {
    id: "course-free-intro",
    title: "Free Intro: What is Mianx.ai?",
    description:
      "New to Mianx.ai? Learn what it is, how it works, and what you can build. 100% free course.",
    instructor: "Mianx.ai Team",
    category: "general",
    level: "beginner",
    price: 0,
    duration: 60,
    isPremium: false,
    lessons: [
      { title: "What is Mianx.ai?", description: "Understand the platform", duration: 10, isPreview: true },
      { title: "Meet the 24 AI Agents", description: "Learn about each agent team", duration: 15, isPreview: true },
      { title: "Your First Project", description: "Create your first project step by step", duration: 20, isPreview: true },
      { title: "Next Steps", description: "Where to go from here", duration: 15, isPreview: true },
    ],
  },
];
