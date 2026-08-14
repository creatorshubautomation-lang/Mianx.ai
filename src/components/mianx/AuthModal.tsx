"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { signIn } from "next-auth/react";
import { Loader2, Sparkles, Mail, Lock, User, Building2 } from "lucide-react";
import { ForgotPasswordModal } from "./ForgotPasswordModal";

export function AuthModal() {
  const { authModal, setAuthModal, setView } = useApp();
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");

  const close = () => setAuthModal(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (res?.error) {
        toast.error("Invalid email or password");
        setLoading(false);
      } else {
        toast.success("Welcome back! Redirecting to dashboard...", {
          duration: 2000,
        });
        // Keep loading state true so button stays disabled
        // Don't close modal — let page reload handle it
        setView("dashboard");
        // refresh to load session
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch {
      toast.error("Something went wrong");
      setLoading(false);
    }
    // Don't set loading to false on success — keep spinner going
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, company }),
      });
      const data = await res.json();

      if (!res.ok) {
        // Show full error message — it includes DB connection help if needed
        const errorMsg = data.error || "Signup failed";
        toast.error(errorMsg, {
          duration: 8000,
          description: data.code === "DB_CONNECTION_FAILED"
            ? "Visit /api/health to debug"
            : undefined,
        });
        console.error("[signup] failed:", data);
        return;
      }

      // Auto sign-in
      const signRes = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (signRes?.error) {
        toast.error("Account created. Please sign in.");
        setLoading(false);
        setAuthModal("login");
      } else {
        toast.success("Account created! Welcome to Mianx.ai 🎉", {
          duration: 2000,
        });
        setView("dashboard");
        // Keep loading state true — spinner stays until page reloads
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch {
      toast.error("Something went wrong");
      setLoading(false);
    }
    // Don't set loading to false on success — keep spinner going
  };

  return (
    <>
    <Dialog open={authModal !== null} onOpenChange={() => close()}>
      <DialogContent
        className="sm:max-w-md glass-strong border-purple-500/30 glow"
        aria-describedby="auth-modal-desc"
      >
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 via-violet-500 to-cyan-500 glow">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <DialogTitle className="text-center text-2xl font-bold">
            {authModal === "login" ? "Welcome back" : "Start building with Mianx.ai"}
          </DialogTitle>
          <p className="text-center text-sm text-muted-foreground mt-1">
            {authModal === "login"
              ? "Sign in to your AI software house"
              : "Create your free account in seconds"}
          </p>
          <p id="auth-modal-desc" className="sr-only">
            {authModal === "login"
              ? "Sign in to your Mianx.ai account"
              : "Create a new Mianx.ai account"}
          </p>
        </DialogHeader>

        <Tabs defaultValue={authModal || "login"} className="w-full">
          <TabsList className="grid w-full grid-cols-2 glass">
            <TabsTrigger value="login">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>

          {/* LOGIN */}
          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="you@company.com"
                    className="pl-9"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="login-password">Password</Label>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-xs text-purple-300 hover:text-purple-200"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-9"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full btn-gradient text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing you in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </TabsContent>

          {/* SIGNUP */}
          <TabsContent value="signup">
            <form onSubmit={handleSignup} className="space-y-3 pt-2">
              <div className="space-y-2">
                <Label htmlFor="signup-name">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="John Doe"
                    className="pl-9"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@company.com"
                    className="pl-9"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-company">Company (optional)</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="signup-company"
                    type="text"
                    placeholder="Acme Inc."
                    className="pl-9"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-9"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full btn-gradient text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating your account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <p className="text-center text-xs text-muted-foreground">
          By continuing, you agree to Mianx.ai&apos;s Terms & Privacy Policy.
        </p>
      </DialogContent>
    </Dialog>

    {/* Forgot Password Modal */}
    <ForgotPasswordModal
      open={showForgotPassword}
      onClose={() => setShowForgotPassword(false)}
      onBackToLogin={() => {
        setShowForgotPassword(false);
        setAuthModal("login");
      }}
    />
    </>
  );
}
