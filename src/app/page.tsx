"use client";

import { useEffect, useState } from "react";
import { SessionProvider, useSession } from "next-auth/react";
import { useApp } from "@/lib/store";
import { Navbar } from "@/components/mianx/Navbar";
import { Footer } from "@/components/mianx/Footer";
import { AuthModal } from "@/components/mianx/AuthModal";
import { DashboardShell } from "@/components/mianx/DashboardShell";
import { ResetPasswordForm } from "@/components/mianx/ForgotPasswordModal";
import { Loader2 } from "lucide-react";

// Public views
import { HomeView } from "@/components/views/HomeView";
import { ServicesView } from "@/components/views/ServicesView";
import { AgentsView } from "@/components/views/AgentsView";
import { PricingView } from "@/components/views/PricingView";
import { AboutView } from "@/components/views/AboutView";
import { UseCasesView } from "@/components/views/UseCasesView";
import { ContactView } from "@/components/views/ContactView";

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
]);

// ─────────────────────────────────────────────
//  Inner component that consumes session
// ─────────────────────────────────────────────
function AppContent() {
  const { view, setAuthModal } = useApp();
  const { data: session, status } = useSession();
  const [resetToken, setResetToken] = useState<string | null>(null);

  // Check for reset_token in URL on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const token = params.get("reset_token");

    if (token) {
      // Use a flag to avoid setState warning
      const timer = setTimeout(() => setResetToken(token), 0);
      return () => clearTimeout(timer);
    }

    // Clean URL if checkout params present
    const checkout = params.get("checkout");
    if (checkout) {
      window.history.replaceState({}, "", "/");
    }
  }, []);

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
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center mb-4 glow">
            <Loader2 className="h-6 w-6 text-white animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground">Loading Mianx.ai...</p>
        </div>
      </div>
    );
  }

  // Public views — accessible to everyone
  if (PUBLIC_VIEWS.has(view)) {
    return (
      <div className="relative min-h-screen mesh-bg flex flex-col">
        <Navbar />
        <main className="flex-1">
          {view === "home" && <HomeView />}
          {view === "services" && <ServicesView />}
          {view === "agents" && <AgentsView />}
          {view === "pricing" && <PricingView />}
          {view === "about" && <AboutView />}
          {view === "useCases" && <UseCasesView />}
          {view === "contact" && <ContactView />}
        </main>
        <Footer />
        <AuthModal />
      </div>
    );
  }

  // Authenticated views — require login
  if (!session?.user) {
    // Force back to home with auth modal
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
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Access Denied</h2>
          <p className="text-sm text-muted-foreground">
            You need admin privileges to access this page.
          </p>
        </div>
      </div>
    );
  }

  // Dashboard views (authenticated)
  return (
    <DashboardShell>
      {view === "dashboard" && <DashboardOverview />}
      {view === "projects" && <ProjectsList />}
      {view === "newProject" && <NewProjectWizard />}
      {view === "projectDetail" && <ProjectDetail />}
      {view === "deliverables" && <DeliverablesList />}
      {view === "support" && <SupportView />}
      {view === "settings" && <SettingsView />}
      {view === "admin" && <AdminPanel />}
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
