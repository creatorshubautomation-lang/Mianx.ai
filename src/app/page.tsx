"use client";

import { useEffect, useState } from "react";
import { SessionProvider, useSession } from "next-auth/react";
import { useApp } from "@/lib/store";
import { initRouter } from "@/lib/router";
import { Navbar } from "@/components/mianx/Navbar";
import { Footer } from "@/components/mianx/Footer";
import { AuthModal } from "@/components/mianx/AuthModal";
import { DashboardShell } from "@/components/mianx/DashboardShell";
import { ResetPasswordForm } from "@/components/mianx/ForgotPasswordModal";
import { Loader2, Sparkles, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Public views
import { HomeView } from "@/components/views/HomeView";
import { ServicesView } from "@/components/views/ServicesView";
import { AgentsView } from "@/components/views/AgentsView";
import { PricingView } from "@/components/views/PricingView";
import { AboutView } from "@/components/views/AboutView";
import { UseCasesView } from "@/components/views/UseCasesView";
import { ContactView } from "@/components/views/ContactView";
import { TemplatesView } from "@/components/views/TemplatesView";
import { ApiDocsView } from "@/components/views/ApiDocsView";
import { AcademyView } from "@/components/views/AcademyView";
import { MarketplaceView } from "@/components/views/MarketplaceView";

// Dashboard views
import { DashboardOverview } from "@/components/views/DashboardOverview";
import { ProjectsList } from "@/components/views/ProjectsList";
import { NewProjectWizard } from "@/components/views/NewProjectWizard";
import { ProjectDetail } from "@/components/views/ProjectDetail";
import { DeliverablesList } from "@/components/views/DeliverablesList";
import { SettingsView } from "@/components/views/SettingsView";
import { SupportView } from "@/components/views/SupportView";
import { AdminPanel } from "@/components/views/AdminPanel";

// ─────────────────────────────────────────────
//  Public views (no auth required)
// ─────────────────────────────────────────────
const PUBLIC_VIEWS = new Set([
  "home",
  "services",
  "agents",
  "pricing",
  "about",
  "useCases",
  "contact",
  "templates",
  "apiDocs",
  "academy",
  "marketplace",
]);

// ─────────────────────────────────────────────
//  Inner component that consumes session
// ─────────────────────────────────────────────
function AppContent() {
  const { view, setAuthModal } = useApp();
  const { data: session, status } = useSession();
  const [resetToken, setResetToken] = useState<string | null>(null);

  // Initialize SPA router and check for special URL params on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Initialize deep-linking router (reads URL → sets initial view)
    initRouter();

    const params = new URLSearchParams(window.location.search);
    const token = params.get("reset_token");

    if (token) {
      const timer = setTimeout(() => setResetToken(token), 0);
      return () => clearTimeout(timer);
    }

    const checkout = params.get("checkout");
    if (checkout) {
      window.history.replaceState({}, "", "/");
    }
  }, []);

  // Scroll to top on view change
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [view]);

  // Show reset password form if token is in URL
  if (resetToken) {
    return (
      <ResetPasswordForm
        token={resetToken}
        onSuccess={() => {
          setResetToken(null);
          setAuthModal("login");
        }}
        onInvalidToken={() => {
          setResetToken(null);
          setAuthModal("login");
        }}
      />
    );
  }

  // Show loading while session is being fetched
  if (status === "loading") {
    return (
      <div className="fixed inset-0 mesh-bg flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 via-violet-500 to-cyan-500 glow"
          >
            <Sparkles className="h-8 w-8 text-white" />
          </motion.div>
          <h1 className="text-2xl font-bold mb-2">
            Mianx<span className="gradient-text">.ai</span>
          </h1>
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
            <p className="text-sm text-muted-foreground">Loading your workspace...</p>
          </div>
          <div className="flex justify-center gap-1 mt-4">
            <motion.span
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
              className="h-2 w-2 rounded-full bg-purple-400"
            />
            <motion.span
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }}
              className="h-2 w-2 rounded-full bg-violet-400"
            />
            <motion.span
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }}
              className="h-2 w-2 rounded-full bg-cyan-400"
            />
          </div>
        </motion.div>
      </div>
    );
  }

  // Public views — accessible to everyone
  if (PUBLIC_VIEWS.has(view)) {
    return (
      <div className="relative min-h-screen mesh-bg flex flex-col">
        <Navbar />
        <main className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {view === "home" && <HomeView />}
              {view === "services" && <ServicesView />}
              {view === "agents" && <AgentsView />}
              {view === "pricing" && <PricingView />}
              {view === "about" && <AboutView />}
              {view === "useCases" && <UseCasesView />}
              {view === "contact" && <ContactView />}
              {view === "templates" && <TemplatesView />}
              {view === "apiDocs" && <ApiDocsView />}
              {view === "academy" && <AcademyView />}
              {view === "marketplace" && <MarketplaceView />}
            </motion.div>
          </AnimatePresence>
        </main>
        <Footer />
        <AuthModal />
      </div>
    );
  }

  // Authenticated views — require login
  if (!session?.user) {
    return (
      <div className="relative min-h-screen mesh-bg flex flex-col">
        <Navbar />
        <main className="flex-1">
          <HomeView />
        </main>
        <Footer />
        <AuthModal />
      </div>
    );
  }

  // Admin-only views
  if (view === "admin" && session.user.role !== "ADMIN") {
    return (
      <div className="min-h-screen mesh-bg flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
            <Shield className="h-8 w-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold mb-2">Access Denied</h2>
          <p className="text-sm text-muted-foreground">
            You need admin privileges to access this page.
          </p>
        </motion.div>
      </div>
    );
  }

  // Dashboard views (authenticated)
  return (
    <DashboardShell>
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          {view === "dashboard" && <DashboardOverview />}
          {view === "projects" && <ProjectsList />}
          {view === "newProject" && <NewProjectWizard />}
          {view === "projectDetail" && <ProjectDetail />}
          {view === "deliverables" && <DeliverablesList />}
          {view === "support" && <SupportView />}
          {view === "settings" && <SettingsView />}
          {view === "admin" && <AdminPanel />}
        </motion.div>
      </AnimatePresence>
    </DashboardShell>
  );
}

export default function Home() {
  return (
    <SessionProvider>
      <AppContent />
    </SessionProvider>
  );
}
