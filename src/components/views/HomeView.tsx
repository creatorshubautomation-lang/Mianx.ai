'use client'

import React from 'react'
import { motion } from 'framer-motion'
import {
  Rocket,
  Bot,
  Workflow,
  Target,
  Shield,
  Building2,
  ArrowRight,
  Play,
  Brain,
  ClipboardList,
  UsersRound,
  Cpu,
  CheckCircle2,
  Sparkles,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { navigate } from '@/lib/router'

// ============================================================
// Animation Variants
// ============================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as [number,number,number,number] },
  },
}

const fadeUpVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0, 0, 0.58, 1] as [number,number,number,number] },
  },
}

// ============================================================
// Data Constants
// ============================================================

const TRUSTED_COMPANIES = [
  'Vercel',
  'Linear',
  'Notion',
  'Figma',
  'Stripe',
  'Supabase',
  'Resend',
  'Clerk',
]

const HOW_IT_WORKS_STEPS = [
  {
    icon: Target,
    title: 'Set Your Goal',
    description: 'Define what you want to achieve in plain language.',
  },
  {
    icon: Brain,
    title: 'Mianx Understands',
    description: 'AI parses intent, constraints, and success criteria.',
  },
  {
    icon: ClipboardList,
    title: 'Plan is Built',
    description: 'A step-by-step execution plan is generated and validated.',
  },
  {
    icon: UsersRound,
    title: 'Workforce Assembled',
    description: 'Specialized agents are selected and configured.',
  },
  {
    icon: Cpu,
    title: 'Execution Begins',
    description: 'Agents work autonomously with real-time progress tracking.',
  },
  {
    icon: CheckCircle2,
    title: 'Verified Outcomes',
    description: 'Results are validated against your original success criteria.',
  },
]

const FEATURES = [
  {
    icon: Rocket,
    title: 'Mission-First',
    description:
      'Define outcomes, not tasks. Mianx reverse-engineers the path from goal to delivery, assembling everything needed automatically.',
    color: '#6366f1',
  },
  {
    icon: Bot,
    title: 'Autonomous Agents',
    description:
      'Deploy specialized AI agents that reason, plan, and act independently. Each agent has tools, memory, and guardrails.',
    color: '#22d3ee',
  },
  {
    icon: Workflow,
    title: 'Workflow Automation',
    description:
      'Chain agents into intelligent workflows with triggers, branches, and approval gates for complex multi-step processes.',
    color: '#a78bfa',
  },
  {
    icon: Target,
    title: 'Outcome Tracking',
    description:
      'Every mission tracks measurable outcomes against baselines. See real-time progress with confidence scores and evidence.',
    color: '#34d399',
  },
  {
    icon: Shield,
    title: 'Enterprise Security',
    description:
    'SOC 2 compliant with role-based access, audit trails, domain isolation, and configurable autonomy levels for every action.',
    color: '#f59e0b',
  },
  {
    icon: Building2,
    title: 'Multi-Tenant',
    description:
    'Isolated workspaces with per-organization domains, team management, billing, and granular permission controls built in.',
    color: '#ec4899',
  },
]

const MOCK_DASHBOARD_TASKS = [
  { name: 'Analyze Q4 revenue data', progress: 85, agent: 'AX' },
  { name: 'Generate marketing copy', progress: 60, agent: 'BK' },
  { name: 'Review pull requests', progress: 100, agent: 'CL' },
  { name: 'Update API documentation', progress: 42, agent: 'DW' },
]

const MOCK_AGENT_AVATARS = ['AX', 'BK', 'CL', 'DW', 'EV']

// ============================================================
// Sub-Components
// ============================================================

function AnimatedGradientOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div
        className="absolute -top-40 -left-40 w-96 h-96 rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
        }}
        animate={{
          x: [0, 40, -20, 0],
          y: [0, -30, 20, 0],
          scale: [1, 1.1, 0.95, 1],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-1/3 -right-32 w-80 h-80 rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(34,211,238,0.12) 0%, transparent 70%)',
        }}
        animate={{
          x: [0, -30, 20, 0],
          y: [0, 40, -20, 0],
          scale: [1, 0.9, 1.08, 1],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-24 left-1/3 w-72 h-72 rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(167,139,250,0.1) 0%, transparent 70%)',
        }}
        animate={{
          x: [0, 50, -30, 0],
          y: [0, -20, 30, 0],
          scale: [1, 1.05, 0.92, 1],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}

function HeroSection() {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      <AnimatedGradientOrbs />
      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <Badge
          variant="outline"
          className="mb-6 px-4 py-1.5 text-sm border-[rgba(99,102,241,0.25)] text-[#a78bfa] bg-[rgba(99,102,241,0.08)]"
          >
          <Sparkles className="w-3.5 h-3.5 mr-1.5" />
          Now in Public Beta
        </Badge>
        </motion.div>

        <motion.h1
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-tight tracking-tight"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
        >
          <span className="text-[#e2e8f0]">The </span>
          <span className="gradient-text">Agentic AI</span>
          <br className="hidden sm:block" />
          <span className="text-[#e2e8f0]"> Operating System for Modern Teams</span>
        </motion.h1>

        <motion.p
          className="mt-6 text-lg sm:text-xl text-[#94a3b8] max-w-2xl mx-auto leading-relaxed"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          Set the goal. Mianx builds the plan, assembles the workforce, and
          delivers verified outcomes.
        </motion.p>

        <motion.div
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
        >
          <Button
            size="lg"
            className="btn-gradient px-8 py-3 text-base font-semibold rounded-xl text-white"
            onClick={() => navigate('dashboard')}
          >
            Get Started
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="px-8 py-3 text-base rounded-xl border-[rgba(99,102,241,0.25)] text-[#e2e8f0] hover:bg-[rgba(99,102,241,0.08)] hover:text-white"
          >
            <Play className="mr-2 w-4 h-4" />
            Watch Demo
          </Button>
        </motion.div>

        <motion.div
          className="mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.5 }}
        >
          {[
            { value: '10x', label: 'Faster Delivery' },
            { value: '94%', label: 'Success Rate' },
            { value: '500+', label: 'Teams Active' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-2xl sm:text-3xl font-bold gradient-text">
                {stat.value}
              </p>
              <p className="text-xs sm:text-sm text-[#94a3b8] mt-1">
                {stat.label}
              </p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

function TrustedBySection() {
  return (
    <section className="py-16 px-6">
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.6 }}
        className="max-w-5xl mx-auto text-center"
      >
        <p className="text-sm text-[#64748b] uppercase tracking-widest font-medium mb-8">
          Trusted by innovative teams worldwide
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {TRUSTED_COMPANIES.map((company, i) => (
            <motion.span
              key={company}
              className="text-lg sm:text-xl font-semibold text-[#475569] hover:text-[#94a3b8] transition-colors duration-300 cursor-default"
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.4 }}
            >
              {company}
            </motion.span>
          ))}
        </div>
      </motion.div>
    </section>
  )
}

function HowItWorksSection() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-14"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={fadeUpVariants}
        >
          <Badge
            variant="outline"
            className="mb-4 px-3 py-1 text-xs border-[rgba(99,102,241,0.25)] text-[#a78bfa] bg-[rgba(99,102,241,0.08)]"
          >
            How It Works
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#e2e8f0]">
            From Goal to Outcome in Six Steps
          </h2>
          <p className="mt-3 text-[#94a3b8] max-w-xl mx-auto">
            Describe what you need. Mianx handles everything else — planning,
            staffing, execution, and verification.
          </p>
        </motion.div>

        <motion.div
          className="relative"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
            {HOW_IT_WORKS_STEPS.map((step, i) => {
              const Icon = step.icon
              return (
                <motion.div
                  key={step.title}
                  variants={itemVariants}
                  className="glass-card card-hover p-6 rounded-xl relative group"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[rgba(99,102,241,0.12)] flex items-center justify-center">
                      <Icon className="w-5 h-5 text-[#6366f1]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#6366f1] bg-[rgba(99,102,241,0.12)] px-2 py-0.5 rounded-full">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                      </div>
                      <h3 className="text-base font-semibold text-[#e2e8f0] mt-2">
                        {step.title}
                      </h3>
                      <p className="text-sm text-[#94a3b8] mt-1.5 leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                  {i < HOW_IT_WORKS_STEPS.length - 1 && (
                    <ChevronRight className="absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6366f1] opacity-30 hidden lg:block" />
                  )}
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function FeaturesGridSection() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-14"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={fadeUpVariants}
        >
          <Badge
            variant="outline"
            className="mb-4 px-3 py-1 text-xs border-[rgba(99,102,241,0.25)] text-[#a78bfa] bg-[rgba(99,102,241,0.08)]"
          >
            Core Capabilities
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#e2e8f0]">
            Everything You Need to Ship Faster
          </h2>
          <p className="mt-3 text-[#94a3b8] max-w-xl mx-auto">
            A complete platform for mission-driven AI teams — from planning to
            production.
          </p>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
        >
          {FEATURES.map((feature) => {
            const Icon = feature.icon
            return (
              <motion.div
                key={feature.title}
                variants={itemVariants}
                className="glass-card card-hover p-6 rounded-xl"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{
                    background: `linear-gradient(135deg, ${feature.color}20, ${feature.color}08)`,
                  }}
                >
                  <Icon
                    className="w-6 h-6"
                    style={{ color: feature.color }}
                  />
                </div>
                <h3 className="text-lg font-semibold text-[#e2e8f0]">
                  {feature.title}
                </h3>
                <p className="text-sm text-[#94a3b8] mt-2 leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}

function ProductShowcaseSection() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          {/* Mock Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7 }}
            className="glass-card p-6 rounded-xl glow order-2 lg:order-1"
          >
            {/* Header Bar */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
                <div className="w-3 h-3 rounded-full bg-[#f59e0b]" />
                <div className="w-3 h-3 rounded-full bg-[#34d399]" />
              </div>
              <span className="text-xs text-[#64748b] font-mono">
                dashboard.mianx.ai
              </span>
              <div className="w-12" />
            </div>

            {/* Agent Avatars Row */}
            <div className="flex items-center gap-2 mb-5">
              <span className="text-xs text-[#94a3b8] mr-2">Active Agents:</span>
              <div className="flex -space-x-2">
                {MOCK_AGENT_AVATARS.map((initials, i) => (
                  <Avatar
                    key={initials}
                    className="w-7 h-7 border-2 border-[#0a0b14]"
                  >
                    <AvatarFallback
                      className="text-[10px] font-semibold"
                      style={{
                        background: ['#6366f1', '#22d3ee', '#a78bfa', '#34d399', '#f59e0b'][i],
                        color: '#0a0b14',
                      }}
                    >
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <Badge
                variant="secondary"
                className="text-[10px] bg-[rgba(52,211,153,0.15)] text-[#34d399] border-0"
              >
                All Online
              </Badge>
            </div>

            {/* Mission Progress Bars */}
            <div className="space-y-4 mb-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#e2e8f0]">
                  Mission Progress
                </span>
                <span className="text-xs text-[#94a3b8]">4 of 6 complete</span>
              </div>
              <Progress value={67} className="h-2" />
            </div>

            <Separator className="bg-[rgba(99,102,241,0.1)] mb-5" />

            {/* Task List */}
            <div className="space-y-3">
              <span className="text-xs text-[#94a3b8] uppercase tracking-wider font-medium">
                Recent Tasks
              </span>
              {MOCK_DASHBOARD_TASKS.map((task) => (
                <div
                  key={task.name}
                  className="flex items-center gap-3 py-1.5"
                >
                  <Avatar className="w-6 h-6">
                    <AvatarFallback className="text-[8px] font-bold bg-[rgba(99,102,241,0.15)] text-[#a78bfa]">
                      {task.agent}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-[#e2e8f0] flex-1 truncate">
                    {task.name}
                  </span>
                  <div className="w-20">
                    <Progress
                      value={task.progress}
                      className="h-1.5"
                    />
                  </div>
                  <span className="text-xs text-[#94a3b8] w-8 text-right">
                    {task.progress}%
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Description Text */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={containerVariants}
            className="order-1 lg:order-2"
          >
            <motion.div variants={fadeUpVariants}>
              <Badge
                variant="outline"
                className="mb-4 px-3 py-1 text-xs border-[rgba(99,102,241,0.25)] text-[#a78bfa] bg-[rgba(99,102,241,0.08)]"
              >
                Live Dashboard
              </Badge>
            </motion.div>
            <motion.h2
              className="text-3xl sm:text-4xl font-bold text-[#e2e8f0]"
              variants={fadeUpVariants}
            >
              Monitor Everything in{' '}
              <span className="gradient-text">Real Time</span>
            </motion.h2>
            <motion.p
              className="mt-4 text-[#94a3b8] leading-relaxed"
              variants={fadeUpVariants}
            >
              Watch your AI workforce execute missions with full visibility.
              Track agent activity, task progress, and outcome metrics — all
              from a single, intuitive dashboard.
            </motion.p>
            <motion.ul className="mt-6 space-y-3" variants={containerVariants}>
              {[
                'Real-time agent status and activity logs',
                'Live task progress with per-agent breakdowns',
                'Outcome verification with confidence scoring',
                'Cost tracking and budget utilization at a glance',
              ].map((item) => (
                <motion.li
                  key={item}
                  variants={itemVariants}
                  className="flex items-center gap-3 text-sm text-[#94a3b8]"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#34d399] flex-shrink-0" />
                  {item}
                </motion.li>
              ))}
            </motion.ul>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

function FinalCtaSection() {
  return (
    <section className="py-24 px-6">
      <motion.div
        className="max-w-3xl mx-auto text-center glass-strong rounded-2xl p-10 sm:p-14 glow"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.7 }}
      >
        <h2 className="text-3xl sm:text-4xl font-bold text-[#e2e8f0]">
          Ready to Transform Your Team?
        </h2>
        <p className="mt-4 text-[#94a3b8] text-lg max-w-xl mx-auto">
          Join hundreds of teams already using Mianx to ship faster with
          autonomous AI agents and mission-driven workflows.
        </p>
        <div className="mt-8">
          <Button
            size="lg"
            className="btn-gradient px-10 py-3 text-base font-semibold rounded-xl text-white"
            onClick={() => navigate('dashboard')}
          >
            Get Started Free
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </div>
        <p className="mt-4 text-xs text-[#64748b]">
          No credit card required. Free tier available for small teams.
        </p>
      </motion.div>
    </section>
  )
}

// ============================================================
// Main HomeView Component
// ============================================================

export default function HomeView() {
  return (
    <div className="min-h-screen bg-[#0a0b14]">
      <main>
        <HeroSection />
        <Separator className="bg-[rgba(99,102,241,0.06)]" />
        <TrustedBySection />
        <Separator className="bg-[rgba(99,102,241,0.06)]" />
        <HowItWorksSection />
        <Separator className="bg-[rgba(99,102,241,0.06)]" />
        <FeaturesGridSection />
        <Separator className="bg-[rgba(99,102,241,0.06)]" />
        <ProductShowcaseSection />
        <Separator className="bg-[rgba(99,102,241,0.06)]" />
        <FinalCtaSection />
      </main>

      {/* Footer */}
      <footer className="border-t border-[rgba(99,102,241,0.08)] py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#22d3ee]" />
            <span className="text-lg font-bold gradient-text">Mianx.ai</span>
          </div>
          <p className="text-sm text-[#64748b]">
            &copy; {new Date().getFullYear()} Mianx.ai — The Agentic AI Operating
            System for Modern Teams
          </p>
          <div className="flex items-center gap-6 text-sm text-[#94a3b8]">
            <button
              type="button"
              className="hover:text-[#e2e8f0] transition-colors"
              onClick={() => navigate('settings')}
            >
              Privacy
            </button>
            <button
              type="button"
              className="hover:text-[#e2e8f0] transition-colors"
              onClick={() => navigate('settings')}
            >
              Terms
            </button>
            <button
              type="button"
              className="hover:text-[#e2e8f0] transition-colors"
              onClick={() => navigate('trust-center')}
            >
              Security
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}
