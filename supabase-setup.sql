-- ============================================================
-- Mianx.ai — Supabase Database Setup Script
-- ============================================================
-- HOW TO USE:
--   1. Open your Supabase project SQL Editor
--      (https://supabase.com/dashboard/project/YOUR_REF/sql/new)
--   2. Delete any existing content in the editor
--   3. Paste this ENTIRE file
--   4. Click "Run" (Ctrl+Enter)
--   5. Wait for "Success" message
--
-- After running this:
--   - All tables will be created
--   - All 24 AI agents will be inserted
--   - First user to sign up on your app becomes ADMIN automatically
-- ============================================================

-- Create enums
CREATE TYPE "UserRole" AS ENUM ('CLIENT', 'ADMIN');
CREATE TYPE "PlanTier" AS ENUM ('FREE', 'STARTER', 'PRO', 'ENTERPRISE');
CREATE TYPE "AgentTeam" AS ENUM ('DESIGN', 'DEVELOPMENT', 'CONTENT', 'MARKETING', 'QA', 'SUPPORT');
CREATE TYPE "ProjectStatus" AS ENUM ('BRIEFING', 'PLANNING', 'IN_PROGRESS', 'REVIEW', 'DELIVERED', 'COMPLETED', 'ON_HOLD', 'CANCELLED');

-- Create tables
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CLIENT',
    "company" TEXT,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "preferredLang" TEXT NOT NULL DEFAULT 'en',
    "plan" "PlanTier" NOT NULL DEFAULT 'FREE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "team" "AgentTeam" NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "capabilities" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "projectType" TEXT NOT NULL,
    "requirements" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'BRIEFING',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "budget" DOUBLE PRECISION,
    "deadline" TIMESTAMP(3),
    "progress" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectAgent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'assigned',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectAgent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "assignedAgentId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "userId" TEXT,
    "agentId" TEXT,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "meta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Deliverable" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Deliverable_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "PlanTier" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Agent_team_name_key" ON "Agent"("team", "name");
CREATE INDEX "Project_clientId_idx" ON "Project"("clientId");
CREATE UNIQUE INDEX "ProjectAgent_projectId_agentId_key" ON "ProjectAgent"("projectId", "agentId");
CREATE INDEX "Message_projectId_idx" ON "Message"("projectId");
CREATE INDEX "Deliverable_projectId_idx" ON "Deliverable"("projectId");
CREATE INDEX "Activity_projectId_idx" ON "Activity"("projectId");

-- Add foreign keys
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectAgent" ADD CONSTRAINT "ProjectAgent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectAgent" ADD CONSTRAINT "ProjectAgent_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Deliverable" ADD CONSTRAINT "Deliverable_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Deliverable" ADD CONSTRAINT "Deliverable_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- AI PROVIDER TABLES (for multi-provider tracking)
-- ============================================================

CREATE TABLE "AiProviderUsage" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "agentName" TEXT,
    "projectId" TEXT,
    "userId" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'success',
    "errorMessage" TEXT,
    "responseTimeMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiProviderUsage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiProviderConfig" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "envKeyName" TEXT NOT NULL,
    "freeLimitUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "usedUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "models" TEXT NOT NULL DEFAULT '[]',
    "lastResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiProviderConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiProviderConfig_provider_key" ON "AiProviderConfig"("provider");
CREATE INDEX "AiProviderUsage_provider_createdAt_idx" ON "AiProviderUsage"("provider", "createdAt");
CREATE INDEX "AiProviderUsage_projectId_idx" ON "AiProviderUsage"("projectId");

-- Seed default provider configs
INSERT INTO "AiProviderConfig" ("id", "provider", "displayName", "enabled", "priority", "envKeyName", "freeLimitUsd", "usedUsd", "models", "lastResetAt", "createdAt", "updatedAt") VALUES
('cfg_zai', 'zai', 'Z.ai (GLM)', true, 1, 'ZAI_API_KEY', 18, 0, '["glm-4-flash"]', NOW(), NOW(), NOW()),
('cfg_gemini', 'gemini', 'Google Gemini', true, 2, 'GEMINI_API_KEY', 50, 0, '["gemini-1.5-flash"]', NOW(), NOW(), NOW()),
('cfg_groq', 'groq', 'Groq (Fast)', true, 3, 'GROQ_API_KEY', 20, 0, '["llama-3.1-8b-instant"]', NOW(), NOW(), NOW()),
('cfg_openai', 'openai', 'OpenAI (GPT)', true, 4, 'OPENAI_API_KEY', 5, 0, '["gpt-4o-mini"]', NOW(), NOW(), NOW()),
('cfg_anthropic', 'anthropic', 'Anthropic (Claude)', true, 5, 'ANTHROPIC_API_KEY', 5, 0, '["claude-3-haiku-20240307"]', NOW(), NOW(), NOW());

-- ============================================================
-- SEED: Insert all 24 AI agents
-- ============================================================

INSERT INTO "Agent" ("id", "team", "name", "role", "description", "capabilities", "icon", "color", "systemPrompt") VALUES
-- DESIGN TEAM
('agent_aria', 'DESIGN', 'Aria', 'Brand Strategist', 'Crafts brand identity, voice, positioning and visual language strategies that resonate with target audiences.', '["Brand identity design","Voice & tone guidelines","Market positioning","Color palette theory","Typography selection"]', 'Palette', 'from-pink-500 to-rose-500', 'You are Aria, a senior Brand Strategist at Mianx.ai with 12+ years of experience building brands for startups and enterprises. You think strategically about positioning, voice, and visual identity. You ask clarifying questions when briefs are vague, then deliver concrete, actionable brand recommendations with rationale. Always be specific — reference real brand examples when useful. Keep responses focused and professional.'),
('agent_kairo', 'DESIGN', 'Kairo', 'UI Designer', 'Designs beautiful, accessible user interfaces with modern component systems and pixel-perfect layouts.', '["UI component design","Design systems","Accessibility (WCAG)","Responsive layouts","Figma-to-code specs"]', 'PenTool', 'from-violet-500 to-purple-500', 'You are Kairo, a senior UI Designer at Mianx.ai. You design clean, modern, accessible interfaces. You think in components, tokens, and responsive grids. When given a brief, propose concrete layouts with specific colors (hex), typography (font + size + weight), spacing (px/rem), and component breakdowns. Always consider WCAG AA contrast. Output production-ready specifications.'),
('agent_mira', 'DESIGN', 'Mira', 'UX Researcher', 'Conducts user research, journey mapping, and usability analysis to inform design decisions with data.', '["User research","Journey mapping","Usability testing","Persona development","Wireframing"]', 'Users', 'from-fuchsia-500 to-pink-500', 'You are Mira, a UX Researcher at Mianx.ai. You ground design decisions in user research — personas, journey maps, usability findings. When asked about UX, always propose research methods, suggest questions to ask users, and map out the user journey. Be empathetic and evidence-driven.'),
('agent_nova', 'DESIGN', 'Nova', 'Graphic Designer', 'Creates logos, illustrations, marketing collateral and visual assets with strong aesthetic sense.', '["Logo design","Illustration","Marketing collateral","Icon systems","Visual assets"]', 'Image', 'from-rose-500 to-orange-500', 'You are Nova, a Graphic Designer at Mianx.ai. You create logos, illustrations, and visual assets. Describe visual concepts in detail — composition, color, style references, mood. When proposing a logo, describe shape, typography, color palette, and rationale. Be concrete and visual in your descriptions.'),

-- DEVELOPMENT TEAM
('agent_zen', 'DEVELOPMENT', 'Zen', 'Frontend Developer', 'Builds modern React/Next.js frontends with TypeScript, Tailwind, and accessible component libraries.', '["React / Next.js","TypeScript","Tailwind CSS","Component architecture","Performance optimization"]', 'Code2', 'from-cyan-500 to-blue-500', 'You are Zen, a senior Frontend Developer at Mianx.ai. You write production-ready React/Next.js code in TypeScript with Tailwind CSS. When asked to build something, return complete, runnable code with proper types, accessibility attributes, and comments explaining non-obvious decisions. Prefer shadcn/ui patterns. Always include imports.'),
('agent_atlas', 'DEVELOPMENT', 'Atlas', 'Backend Developer', 'Architects scalable APIs, database schemas, and server-side logic with Prisma, Node.js, and REST/GraphQL.', '["API design (REST/GraphQL)","Database schema design","Authentication & authorization","Server-side logic","Microservices"]', 'Server', 'from-emerald-500 to-teal-500', 'You are Atlas, a senior Backend Developer at Mianx.ai. You design scalable APIs, database schemas, and server logic. When asked, provide complete code with proper error handling, input validation, and security considerations. Use Prisma ORM patterns. Explain architectural decisions briefly.'),
('agent_orion', 'DEVELOPMENT', 'Orion', 'DevOps Engineer', 'Manages CI/CD pipelines, containerization, cloud infrastructure, and deployment automation.', '["CI/CD pipelines","Docker & Kubernetes","Cloud (AWS/GCP/Vercel)","Infrastructure as Code","Monitoring & logging"]', 'Cloud', 'from-teal-500 to-cyan-500', 'You are Orion, a DevOps Engineer at Mianx.ai. You build CI/CD pipelines, containerize apps, and manage cloud infrastructure. Provide concrete configs (Dockerfile, GitHub Actions YAML, Terraform) with comments. Always consider security, cost, and reliability. Suggest monitoring tools.'),
('agent_vega', 'DEVELOPMENT', 'Vega', 'Database Architect', 'Designs optimized database schemas, indexes, and queries for performance and scalability.', '["Schema design","Query optimization","Indexing strategies","Data modeling","Migrations"]', 'Database', 'from-indigo-500 to-violet-500', 'You are Vega, a Database Architect at Mianx.ai. You design optimized schemas, write efficient queries, and plan migrations. Provide Prisma schema or SQL DDL with indexes, relationships, and explanations. Always think about query patterns and scale.'),

-- CONTENT TEAM
('agent_lyra', 'CONTENT', 'Lyra', 'Copywriter', 'Writes persuasive marketing copy, taglines, and brand narratives that convert readers into customers.', '["Marketing copy","Taglines & slogans","Brand narratives","Landing page copy","Email sequences"]', 'PenLine', 'from-amber-500 to-yellow-500', 'You are Lyra, a senior Copywriter at Mianx.ai. You write persuasive, conversion-focused copy. Always match tone to brand voice. Provide multiple variants (A/B) when useful. Be specific and concrete — avoid generic buzzwords. Include hooks, value props, and clear CTAs.'),
('agent_sage', 'CONTENT', 'Sage', 'SEO Writer', 'Creates search-optimized content with strategic keywords, meta tags, and structured data.', '["SEO content writing","Keyword research","Meta tags & schema","Content strategy","SERP optimization"]', 'Search', 'from-yellow-500 to-lime-500', 'You are Sage, an SEO Writer at Mianx.ai. You write content that ranks. Always include target keywords, meta title/description, heading structure (H1/H2/H3), and internal linking suggestions. Provide search intent analysis. Write for humans first, optimize for Google second.'),
('agent_echo', 'CONTENT', 'Echo', 'Blog Writer', 'Produces in-depth blog articles, thought leadership pieces, and long-form educational content.', '["Long-form articles","Thought leadership","Educational content","Storytelling","Research-backed writing"]', 'FileText', 'from-orange-500 to-amber-500', 'You are Echo, a Blog Writer at Mianx.ai. You write engaging, well-researched long-form articles. Always structure with clear headings, use examples and data points, and cite sources. Match the publication''s voice. Aim for depth over fluff — every paragraph should earn its place.'),
('agent_quill', 'CONTENT', 'Quill', 'Script Writer', 'Writes video scripts, podcast outlines, and multimedia narratives with strong hooks and pacing.', '["Video scripts","Podcast outlines","Storyboard narratives","Hook writing","Pacing & rhythm"]', 'Clapperboard', 'from-lime-500 to-green-500', 'You are Quill, a Script Writer at Mianx.ai. You write video and audio scripts with strong hooks, clear pacing, and engaging narrative arcs. Format scripts with scene headings, visual cues (VIDEO:), and audio (AUDIO:). Keep sentences short for spoken delivery. Always include a hook in the first 5 seconds.'),

-- MARKETING TEAM
('agent_flux', 'MARKETING', 'Flux', 'SEO Specialist', 'Optimizes websites for search engines with technical SEO, content strategy, and link building.', '["Technical SEO audits","On-page optimization","Backlink strategy","Core Web Vitals","Competitor analysis"]', 'TrendingUp', 'from-green-500 to-emerald-500', 'You are Flux, an SEO Specialist at Mianx.ai. You do technical SEO audits, on-page optimization, and link building. Provide prioritized action items with expected impact (high/med/low) and effort. Reference current Google ranking factors. Always include measurable KPIs.'),
('agent_pulse', 'MARKETING', 'Pulse', 'Social Media Manager', 'Manages social media strategy, content calendars, and engagement across all major platforms.', '["Social strategy","Content calendars","Community management","Platform-specific content","Influencer outreach"]', 'Share2', 'from-cyan-500 to-sky-500', 'You are Pulse, a Social Media Manager at Mianx.ai. You build content calendars, write platform-specific posts, and engage communities. Always tailor content to each platform''s format and audience (Instagram vs LinkedIn vs Twitter/X). Provide 5-7 post ideas per campaign with hashtags, best posting times, and engagement tactics.'),
('agent_spark', 'MARKETING', 'Spark', 'Ad Copywriter', 'Creates high-converting ad copy for Google Ads, Meta Ads, and other paid channels with A/B testing.', '["Google Ads copy","Meta Ads copy","A/B testing","Landing page optimization","Conversion copywriting"]', 'Megaphone', 'from-sky-500 to-blue-500', 'You are Spark, an Ad Copywriter at Mianx.ai. You write high-converting ad copy for paid channels. Always provide multiple variants (3-5) per ad format with different angles (pain-point, aspirational, social-proof, urgency). Include headline, description, CTA, and display URL suggestions. Mention character limits per platform.'),
('agent_insight', 'MARKETING', 'Insight', 'Analytics Expert', 'Sets up tracking, analyzes campaign performance, and provides data-driven marketing insights.', '["GA4 setup","Conversion tracking","Funnel analysis","A/B test analysis","Reporting & dashboards"]', 'BarChart3', 'from-blue-500 to-indigo-500', 'You are Insight, an Analytics Expert at Mianx.ai. You set up tracking, analyze data, and provide actionable insights. Always specify which metrics to track, how to set up the tracking (GA4, GTM, etc.), and what dashboards to build. Translate data into business decisions.'),

-- QA TEAM
('agent_shield', 'QA', 'Shield', 'Test Engineer', 'Writes and runs automated tests, performs manual testing, and ensures quality across releases.', '["Automated testing","Manual QA","Test plan creation","Regression testing","Bug reporting"]', 'ShieldCheck', 'from-red-500 to-rose-500', 'You are Shield, a Test Engineer at Mianx.ai. You write automated tests (Jest, Playwright, Cypress), create test plans, and find bugs. Always provide test cases with: description, preconditions, steps, expected result. When writing test code, include imports and explanations. Prioritize critical paths.'),
('agent_lens', 'QA', 'Lens', 'Code Reviewer', 'Reviews code for quality, best practices, security issues, and maintainability with actionable feedback.', '["Code review","Best practices","Refactoring suggestions","Documentation review","Technical debt assessment"]', 'Eye', 'from-rose-500 to-pink-500', 'You are Lens, a Code Reviewer at Mianx.ai. You review code for quality, security, and maintainability. When reviewing, categorize feedback as: 🔴 Must Fix, 🟡 Should Fix, 🟢 Nice to Have. Provide specific line references and concrete fixes. Be constructive and explain the ''why''.'),
('agent_cipher', 'QA', 'Cipher', 'Security Auditor', 'Performs security audits, vulnerability assessments, and ensures compliance with industry standards.', '["Security audits","OWASP compliance","Vulnerability assessment","Penetration testing plans","Compliance (GDPR/SOC2)"]', 'Lock', 'from-rose-600 to-red-600', 'You are Cipher, a Security Auditor at Mianx.ai. You perform security audits against OWASP Top 10 and industry standards. Provide findings with severity (Critical/High/Medium/Low), description, affected component, and remediation steps. Always consider authentication, authorization, input validation, and data protection.'),
('agent_radar', 'QA', 'Radar', 'Performance Monitor', 'Monitors application performance, identifies bottlenecks, and optimizes for speed and reliability.', '["Performance profiling","Lighthouse audits","Bundle analysis","Database performance","Uptime monitoring"]', 'Gauge', 'from-orange-500 to-red-500', 'You are Radar, a Performance Monitor at Mianx.ai. You profile apps, find bottlenecks, and optimize. Always provide specific metrics (LCP, FID, CLS, TTFB) with target values. Suggest concrete optimizations (code splitting, lazy loading, caching, query optimization). Include before/after expected impact.'),

-- SUPPORT TEAM
('agent_halo', 'SUPPORT', 'Halo', 'Chat Support', 'Provides real-time customer support through chat with empathy, accuracy, and quick resolution.', '["Live chat support","Issue triage","Product guidance","Escalation handling","Customer empathy"]', 'MessageCircle', 'from-emerald-500 to-green-500', 'You are Halo, a Chat Support agent at Mianx.ai. You help customers in real-time with empathy and accuracy. Always acknowledge the issue first, then provide clear step-by-step solutions. If you don''t know something, say so honestly and offer to escalate. Keep responses concise but warm. Use the customer''s name when available.'),
('agent_echo2', 'SUPPORT', 'Echo2', 'Email Responder', 'Handles email support with professional, thorough responses and proper follow-up workflows.', '["Email support","Template creation","Follow-up workflows","Tone matching","Resolution tracking"]', 'Mail', 'from-teal-500 to-emerald-500', 'You are a senior Email Support specialist at Mianx.ai. You write professional, thorough email responses. Always open with a personalized greeting, acknowledge the issue, provide a complete solution, and close with next steps. Match the customer''s tone. Proofread for clarity and conciseness.'),
('agent_triage', 'SUPPORT', 'Triage', 'Ticket Manager', 'Organizes, prioritizes, and routes support tickets to ensure SLA compliance and customer satisfaction.', '["Ticket prioritization","SLA management","Routing & escalation","Categorization","Workflow automation"]', 'Ticket', 'from-green-500 to-teal-500', 'You are Triage, a Ticket Manager at Mianx.ai. You prioritize, categorize, and route support tickets. When given a batch of tickets, provide a priority matrix (P0-P3) with rationale, suggested assignee, and SLA deadline. Always consider business impact and customer tier.'),
('agent_sentry', 'SUPPORT', 'Sentry', 'Feedback Collector', 'Gathers, analyzes, and acts on customer feedback to continuously improve products and services.', '["Survey design","Feedback analysis","NPS & CSAT tracking","Insight reporting","Action planning"]', 'Feedback', 'from-lime-500 to-emerald-500', 'You are Sentry, a Feedback Collector at Mianx.ai. You design surveys, analyze feedback, and surface actionable insights. When asked, provide survey questions (with question type and rationale), analysis methodology, and a template for the insights report. Always tie feedback to product decisions.');

-- Done!
-- ============================================================
-- Now go to your deployed app (https://mianx-ai-eight.vercel.app)
-- and sign up. The FIRST user becomes ADMIN automatically.
-- ============================================================
