"use client";

import { useState, useMemo } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { signIn } from "next-auth/react";
import {
  Loader2,
  Sparkles,
  Mail,
  Lock,
  User,
  Building2,
  Eye,
  EyeOff,
  CheckCircle2,
} from "lucide-react";
import { ForgotPasswordModal } from "./ForgotPasswordModal";

export function AuthModal() {
  const { authModal, setAuthModal, navigate } = useApp();
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  const close = () => setAuthModal(null);

  // --- Password strength ---
  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: "", color: "" };
    const rules = [
      password.length >= 6,
      /[A-Z]/.test(password),
      /[0-9]/.test(password),
      /[^A-Za-z0-9]/.test(password),
    ];
    const score = rules.filter(Boolean).length;
    if (score < 2) return { score, label: "Weak", color: "bg-red-500" };
    if (score < 4) return { score, label: "Medium", color: "bg-amber-500" };
    return { score, label: "Strong", color: "bg-green-500" };
  }, [password]);

  const passwordRules = useMemo(() => [
    { met: password.length >= 6, text: "At least 6 characters" },
    { met: /[A-Z]/.test(password), text: "One uppercase letter" },
    { met: /[0-9]/.test(password), text: "One number" },
    { met: /[^A-Za-z0-9]/.test(password), text: "One special character" },
  ], [password]);

  // --- Field validity helpers ---
  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const isValidName = (v: string) => v.trim().length >= 2;
  const isConfirmValid = confirmPassword.length > 0 && confirmPassword === password;

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
        navigate("dashboard");
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

    // More specific validation before sending
    if (!isValidName(name)) {
      toast.error("Please enter your full name (at least 2 characters)");
      return;
    }
    if (!isValidEmail(email)) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match — please double-check");
      return;
    }
    if (!agreeTerms) {
      toast.error("Please agree to the Terms & Privacy Policy");
      return;
    }

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
          description:
            data.code === "DB_CONNECTION_FAILED"
              ? "Visit /api/health to debug"
              : data.code === "EMAIL_TAKEN"
                ? "Try signing in instead, or use a different email."
                : data.code === "WEAK_PASSWORD"
                  ? "Use 6+ characters with uppercase, number, and special char."
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
        navigate("dashboard");
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
                    className="pl-9 pr-9"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  {email.length > 0 && isValidEmail(email) && (
                    <CheckCircle2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-green-500" />
                  )}
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
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-9 pr-9"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember-me"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                  className="data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                />
                <Label
                  htmlFor="remember-me"
                  className="text-sm text-muted-foreground cursor-pointer select-none"
                >
                  Remember me
                </Label>
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
                    className="pl-9 pr-9"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                  {name.length > 0 && isValidName(name) && (
                    <CheckCircle2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-green-500" />
                  )}
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
                    className="pl-9 pr-9"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  {email.length > 0 && isValidEmail(email) && (
                    <CheckCircle2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-green-500" />
                  )}
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
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-9 pr-9"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {/* Password strength meter */}
                {password.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span
                        className={
                          passwordStrength.label === "Weak"
                            ? "text-red-400"
                            : passwordStrength.label === "Medium"
                              ? "text-amber-400"
                              : "text-green-400"
                        }
                      >
                        {passwordStrength.label}
                      </span>
                      <span className="text-muted-foreground">
                        {passwordStrength.score}/4 rules
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${passwordStrength.color}`}
                        style={{ width: `${(passwordStrength.score / 4) * 100}%` }}
                      />
                    </div>
                    <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                      {passwordRules.map((rule) => (
                        <li
                          key={rule.text}
                          className="flex items-center gap-1 text-xs"
                        >
                          <CheckCircle2
                            className={`h-3 w-3 shrink-0 ${rule.met ? "text-green-500" : "text-muted-foreground/40"}`}
                          />
                          <span
                            className={
                              rule.met
                                ? "text-green-400"
                                : "text-muted-foreground"
                            }
                          >
                            {rule.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="signup-confirm-password">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="signup-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-9 pr-9"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                  {confirmPassword.length > 0 && isConfirmValid && (
                    <CheckCircle2 className="absolute right-10 top-1/2 h-4 w-4 -translate-y-1/2 text-green-500" />
                  )}
                </div>
                {confirmPassword.length > 0 && !isConfirmValid && (
                  <p className="text-xs text-red-400">Passwords don&apos;t match</p>
                )}
              </div>

              {/* Terms checkbox */}
              <div className="flex items-start gap-2 pt-1">
                <Checkbox
                  id="agree-terms"
                  checked={agreeTerms}
                  onCheckedChange={(checked) => setAgreeTerms(checked === true)}
                  className="mt-0.5 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                />
                <Label
                  htmlFor="agree-terms"
                  className="text-xs text-muted-foreground cursor-pointer select-none leading-relaxed"
                >
                  I agree to Mianx.ai&apos;s{" "}
                  <span className="text-purple-300 hover:text-purple-200 underline underline-offset-2">
                    Terms of Service
                  </span>{" "}
                  &{" "}
                  <span className="text-purple-300 hover:text-purple-200 underline underline-offset-2">
                    Privacy Policy
                  </span>
                </Label>
              </div>

              <Button
                type="submit"
                disabled={loading || !agreeTerms}
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
          {authModal === "signup"
            ? "Your data is encrypted and never shared with third parties."
            : "By continuing, you agree to Mianx.ai\u0027s Terms & Privacy Policy."}
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
