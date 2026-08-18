'use client'

import { motion } from 'framer-motion'
import {
  Sparkles,
  ArrowRight,
  Bot,
  Target,
  Workflow,
  ShieldCheck,
  Zap,
  BarChart3,
  Globe,
  ChevronRight,
  CheckCircle2,
  Star,
  Download,
  Github,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { navigate } from '@/lib/router'

function fadeUpDelay(i: number) {
  return {
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.45, ease: 'easeOut' as const } },
  }
}

const features = [
  {
    icon: Bot,
    title: 'AI Workforce',
    desc: 'Assemble teams of autonomous AI agents that collaborate and scale with your business.',
  },
  {
    icon: Target,
    title: 'Mission Engine',
    desc: 'Define goals, not tasks. AI breaks objectives into verifiable outcomes with quality gates.',
  },
  {
    icon: Workflow,
    title: 'Smart Workflows',
    desc: 'Automate processes with approval chains and human-in-the-loop oversight.',
  },
  {
    icon: ShieldCheck,
    title: 'Enterprise Security',
    desc: 'RBAC, audit logs, tool risk levels, and full transparency into every AI action.',
  },
  {
    icon: Zap,
    title: 'Domain Packs',
    desc: 'Plug-and-play knowledge modules for sales, marketing, engineering, and more.',
  },
  {
    icon: BarChart3,
    title: 'Real-time Analytics',
    desc: 'Track outcomes, costs, and performance across every mission.',
  },
]

function ProductMockup() {
  return (
    <div className="relative mx-auto max-w-5xl mt-12 lg:mt-16">
      {/* Glow behind the mockup */}
      <div className="absolute inset-0 bg-gradient-to-tr from-violet-200/60 via-amber-100/40 to-rose-100/50 rounded-3xl blur-2xl scale-95" aria-hidden="true" />

      {/* Mock browser window */}
      <div className="relative bg-white rounded-2xl shadow-2xl shadow-black/10 border border-gray-200/80 overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-amber-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="px-4 py-1 rounded-md bg-gray-100 text-xs text-gray-500 font-mono">
              app.mianx.ai
            </div>
          </div>
          <div className="w-12" />
        </div>

        {/* App content mockup */}
        <div className="flex h-[340px] sm:h-[420px] lg:h-[480px]">
          {/* Sidebar mockup */}
          <div className="w-52 bg-slate-900 text-white p-4 hidden sm:flex flex-col shrink-0">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-bold">Mianx</span>
            </div>
            <div className="space-y-1 flex-1">
              {['Dashboard', 'Missions', 'Agents', 'Workflows', 'Integrations', 'Billing'].map((item, i) => (
                <div
                  key={item}
                  className={`px-3 py-2 rounded-lg text-xs font-medium ${i === 0 ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {item}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-4 border-t border-slate-700">
              <div className="w-6 h-6 rounded-full bg-violet-500/30 flex items-center justify-center text-[10px] font-medium">AC</div>
              <span className="text-xs text-slate-400">Alex Chen</span>
            </div>
          </div>

          {/* Main content mockup */}
          <div className="flex-1 bg-gradient-to-br from-slate-50 to-slate-100 p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-sm font-semibold text-slate-800">Dashboard</p>
                <p className="text-xs text-slate-500">Welcome back, Alex</p>
              </div>
              <div className="flex gap-2">
                <div className="w-8 h-8 rounded-lg bg-white shadow-sm border border-gray-200 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-violet-500" />
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Active Agents', value: '12', color: 'bg-emerald-500' },
                { label: 'Missions', value: '8', color: 'bg-violet-500' },
                { label: 'Success Rate', value: '94%', color: 'bg-amber-500' },
                { label: 'AI Cost', value: '$24', color: 'bg-sky-500' },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                  <div className={`w-2 h-2 rounded-full ${s.color} mb-2`} />
                  <p className="text-lg font-bold text-slate-800">{s.value}</p>
                  <p className="text-[10px] text-slate-500">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Mission list mockup */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs font-semibold text-slate-700 mb-3">Recent Missions</p>
              {[
                { name: 'Customer Onboarding Flow', status: 'Running', statusColor: 'bg-emerald-100 text-emerald-700' },
                { name: 'Q3 Revenue Analysis', status: 'Completed', statusColor: 'bg-violet-100 text-violet-700' },
                { name: 'Security Audit', status: 'In Review', statusColor: 'bg-amber-100 text-amber-700' },
              ].map((m) => (
                <div key={m.name} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <p className="text-xs text-slate-700 font-medium">{m.name}</p>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${m.statusColor}`}>{m.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LandingView() {
  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="mx-auto max-w-6xl flex items-center justify-between h-16 px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">
              Mianx<span className="text-violet-600">.ai</span>
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">How It Works</a>
            <a href="#testimonials" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">Testimonials</a>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => navigate('login')}
              className="text-sm text-slate-600 hover:text-slate-900 hidden sm:inline-flex"
            >
              Sign in
            </Button>
            <Button
              onClick={() => navigate('login')}
              className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/10 h-9 px-4 text-sm font-medium"
            >
              Get Started
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </nav>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative pt-28 pb-4 px-4 sm:px-6 overflow-hidden">
          {/* Subtle gradient background */}
          <div className="absolute inset-0 bg-gradient-to-b from-amber-50/40 via-white to-white" aria-hidden="true" />
          <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-violet-200/30 rounded-full blur-[120px]" aria-hidden="true" />
          <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-amber-200/20 rounded-full blur-[100px]" aria-hidden="true" />

          <div className="relative mx-auto max-w-4xl text-center">
            <div className="space-y-6">
              <motion.div {...fadeUpDelay(0)} className="flex justify-center">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-violet-100 text-violet-700 border border-violet-200">
                  <Sparkles className="w-3 h-3" />
                  Now in Public Beta
                </span>
              </motion.div>

              <motion.h1
                {...fadeUpDelay(1)}
                className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 leading-tight"
              >
                The{' '}
                <span className="bg-gradient-to-r from-violet-600 via-indigo-600 to-emerald-600 bg-clip-text text-transparent">
                  Agentic AI
                </span>{' '}
                Operating System
              </motion.h1>

              <motion.p
                {...fadeUpDelay(2)}
                className="mx-auto max-w-2xl text-lg text-slate-500 leading-relaxed"
              >
                Set the goal. Mianx builds the plan, assembles the AI workforce, and delivers verified outcomes — for modern teams.
              </motion.p>

              <motion.div {...fadeUpDelay(3)} className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  size="lg"
                  onClick={() => navigate('login')}
                  className="bg-slate-900 hover:bg-slate-800 text-white shadow-xl shadow-slate-900/10 h-12 px-8 text-base font-medium"
                >
                  Get Started
                  <ArrowRight className="w-5 h-5 ml-1.5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-slate-200 hover:bg-slate-50 h-12 px-8 text-base font-medium text-slate-700"
                  onClick={() => {
                    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })
                  }}
                >
                  Watch Demo
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </motion.div>

              <motion.p {...fadeUpDelay(4)} className="text-xs text-slate-400">
                Free to start · No credit card required
              </motion.p>
            </div>

            {/* Stats bar */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="mt-12 flex flex-wrap items-center justify-center gap-8 sm:gap-16 text-center"
            >
              {[{ value: '10x', label: 'Faster Delivery' }, { value: '94%', label: 'Success Rate' }, { value: '500+', label: 'Teams Active' }].map((s) => (
                <div key={s.label}>
                  <p className="text-2xl sm:text-3xl font-bold text-slate-900">{s.value}</p>
                  <p className="text-sm text-slate-500">{s.label}</p>
                </div>
              ))}
            </motion.div>

            {/* Product Mockup */}
            <ProductMockup />
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 px-4 sm:px-6 bg-slate-50">
          <div className="mx-auto max-w-6xl">
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">Everything you need</h2>
              <p className="mt-3 text-lg text-slate-500 max-w-xl mx-auto">
                A complete operating system for AI-powered team operations.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ delay: i * 0.08, duration: 0.35 }}
                >
                  <div className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-violet-200 hover:shadow-lg hover:shadow-violet-500/5 transition-all h-full">
                    <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center mb-4">
                      <f.icon className="w-5 h-5 text-violet-600" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-900 mb-2">{f.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-24 px-4 sm:px-6">
          <div className="mx-auto max-w-4xl">
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">How it works</h2>
              <p className="mt-3 text-lg text-slate-500">Four steps from goal to verified outcome.</p>
            </div>
            <div className="space-y-0">
              {[
                { step: '01', title: 'Define Your Mission', desc: 'Tell Mianx what you want to achieve. Our engine translates goals into actionable plans with milestones.' },
                { step: '02', title: 'Assemble Your Workforce', desc: 'AI agents are auto-assigned based on skills and domain expertise. Or hand-pick your team.' },
                { step: '03', title: 'Execute & Verify', desc: 'Agents work autonomously with built-in verification. Human approvals at critical checkpoints.' },
                { step: '04', title: 'Measure Outcomes', desc: 'Track real-time progress, costs, and quality metrics. Continuous improvement with every mission.' },
              ].map((s, i) => (
                <motion.div
                  key={s.step}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ delay: i * 0.1, duration: 0.35 }}
                  className="relative flex gap-6 pb-10 last:pb-0"
                >
                  {i < 3 && (
                    <div className="absolute left-[19px] top-10 bottom-0 w-px bg-gradient-to-b from-violet-200 to-transparent" aria-hidden="true" />
                  )}
                  <div className="w-10 h-10 rounded-full bg-violet-600 text-white flex items-center justify-center text-sm font-bold shrink-0 relative z-10">
                    {s.step}
                  </div>
                  <div className="pt-1.5">
                    <h3 className="text-lg font-semibold text-slate-900">{s.title}</h3>
                    <p className="mt-1 text-sm text-slate-500 leading-relaxed max-w-lg">{s.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section id="testimonials" className="py-24 px-4 sm:px-6 bg-slate-50">
          <div className="mx-auto max-w-6xl">
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">Loved by teams</h2>
              <p className="mt-3 text-lg text-slate-500">See what leaders are saying about Mianx.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { quote: 'Mianx transformed how we handle customer onboarding. What took 3 days now happens in 2 hours.', name: 'Sarah Kim', role: 'VP Operations, TechCorp' },
                { quote: 'The mission engine is a game-changer. We define outcomes, and AI agents figure out the how.', name: 'James Rodriguez', role: 'CTO, ScaleUp Inc' },
                { quote: 'Trust center gives us full visibility. Our compliance team finally sleeps at night.', name: 'Aisha Patel', role: 'Head of Security, FinServe' },
              ].map((t, i) => (
                <motion.div
                  key={t.name}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ delay: i * 0.1, duration: 0.35 }}
                >
                  <div className="bg-white rounded-2xl p-6 border border-gray-100 h-full">
                    <div className="flex gap-0.5 mb-4">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed mb-6">&ldquo;{t.quote}&rdquo;</p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-sm font-medium">
                        {t.name.split(' ').map((n) => n[0]).join('')}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{t.name}</p>
                        <p className="text-xs text-slate-500">{t.role}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="mx-auto max-w-3xl text-center"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Ready to transform your team?
            </h2>
            <p className="text-lg text-slate-500 mb-8">
              Join hundreds of teams already using Mianx to ship faster with AI-powered operations.
            </p>
            <Button
              size="lg"
              onClick={() => navigate('login')}
              className="bg-slate-900 hover:bg-slate-800 text-white shadow-xl shadow-slate-900/10 h-12 px-8 text-base font-medium"
            >
              Get Started for Free
              <ArrowRight className="w-5 h-5 ml-1.5" />
            </Button>
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-12 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-semibold text-slate-900">Mianx.ai</span>
          </div>
          <p className="text-xs text-slate-400">&copy; {new Date().getFullYear()} Mianx.ai. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Globe className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-400">English</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
