'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useStore } from '@/lib/store'
import { navigate } from '@/lib/router'
import { signIn } from 'next-auth/react'

export default function LoginView() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const setUser = useStore((s) => s.setUser)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isSignUp) {
        // Registration flow
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            displayName: name || undefined,
          }),
        })

        const json = await res.json()

        if (!res.ok) {
          const msg = json?.error?.message || 'Registration failed. Please try again.'
          setError(msg)
          return
        }

        // After successful registration, sign in automatically
        const signInRes = await signIn('credentials', {
          email,
          password,
          redirect: false,
        })

        if (signInRes?.error) {
          setError('Account created but sign-in failed. Please try signing in manually.')
          return
        }
      } else {
        // Login flow — use NextAuth
        const signInRes = await signIn('credentials', {
          email,
          password,
          redirect: false,
        })

        if (signInRes?.error) {
          setError('Invalid email or password. Please try again.')
          return
        }
      }

      // Fetch session to get user data
      const sessionRes = await fetch('/api/auth/session')
      const session = await sessionRes.json()

      if (session?.user) {
        setUser({
          id: (session.user as Record<string, unknown>).id as string,
          email: session.user.email ?? '',
          displayName: (session.user as Record<string, unknown>).displayName as string || session.user.name || '',
          avatarUrl: session.user.image ?? null,
          locale: 'en',
          timezone: 'UTC',
          createdAt: new Date().toISOString(),
        })
        navigate('dashboard')
      } else {
        setError('Session could not be established. Please try again.')
      }
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDemoLogin = async () => {
    setError('')
    setLoading(true)
    try {
      const signInRes = await signIn('credentials', {
        email: 'demo@mianx.ai',
        password: 'demo1234',
        redirect: false,
      })

      if (signInRes?.error) {
        setError('Demo account not available. Please register a new account.')
        return
      }

      const sessionRes = await fetch('/api/auth/session')
      const session = await sessionRes.json()

      if (session?.user) {
        setUser({
          id: (session.user as Record<string, unknown>).id as string,
          email: session.user.email ?? '',
          displayName: (session.user as Record<string, unknown>).displayName as string || session.user.name || 'Alex Chen',
          avatarUrl: session.user.image ?? null,
          locale: 'en',
          timezone: 'UTC',
          createdAt: new Date().toISOString(),
        })
        navigate('dashboard')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-white text-slate-900 relative overflow-hidden">
      {/* Left panel — branding (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-slate-900 via-slate-800 to-violet-900/80 items-center justify-center p-12">
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-violet-500/20 rounded-full blur-[100px]" aria-hidden="true" />
          <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-indigo-500/15 rounded-full blur-[120px]" aria-hidden="true" />
        </div>

        <div className="relative z-10 max-w-md space-y-8">
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-2xl font-bold text-white">Mianx<span className="text-violet-400">.ai</span></span>
            </div>
            <h2 className="text-3xl font-bold text-white leading-tight">
              AI That Delivers{' '}
              <span className="bg-gradient-to-r from-violet-400 to-emerald-400 bg-clip-text text-transparent">
                Verified Outcomes
              </span>
            </h2>
            <p className="mt-4 text-slate-400 leading-relaxed">
              Join thousands of teams using Mianx to automate operations, manage AI workforces, and track mission-critical outcomes.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="space-y-4"
          >
            {['Autonomous AI agents that work 24/7', 'Mission engine with built-in verification', 'Enterprise-grade security & compliance'].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-sm text-slate-300">{item}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-md space-y-8"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">Mianx<span className="text-violet-600">.ai</span></span>
          </div>

          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('landing')}
              className="text-slate-500 hover:text-slate-900 -ml-2 mb-6"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <h1 className="text-2xl font-bold text-slate-900">
              {isSignUp ? 'Create your account' : 'Welcome back'}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {isSignUp
                ? 'Start your free trial. No credit card required.'
                : 'Sign in to your Mianx workspace.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium text-slate-700">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Alex Chen"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11 bg-white border-gray-200 focus:border-violet-400 focus:ring-violet-400/20"
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-slate-700">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 pl-10 bg-white border-gray-200 focus:border-violet-400 focus:ring-violet-400/20"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium text-slate-700">Password</Label>
                {!isSignUp && (
                  <button type="button" className="text-xs text-violet-600 hover:text-violet-500 transition-colors">
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={isSignUp ? 'Min. 8 characters' : '••••••••'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pl-10 pr-10 bg-white border-gray-200 focus:border-violet-400 focus:ring-violet-400/20"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-medium"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {isSignUp ? 'Creating account...' : 'Signing in...'}
                </div>
              ) : (
                <>
                  {isSignUp ? 'Create Account' : 'Sign In'}
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </form>

          <div className="relative">
            <Separator className="bg-gray-200" />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-3 text-xs text-slate-400">
              or
            </span>
          </div>

          <Button
            variant="outline"
            onClick={handleDemoLogin}
            disabled={loading}
            className="w-full h-11 border-gray-200 hover:bg-slate-50 font-medium text-slate-700"
          >
            Try Demo Account
          </Button>

          <p className="text-center text-sm text-slate-500">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              onClick={() => { setIsSignUp(!isSignUp); setError('') }}
              className="text-violet-600 hover:text-violet-500 font-medium transition-colors"
            >
              {isSignUp ? 'Sign in' : 'Sign up for free'}
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
