"use client";

import { useApp, useT } from "@/lib/store";
import { useSession } from "next-auth/react";
import { Sparkles, Twitter, Github, Linkedin, Mail } from "lucide-react";

export function Footer() {
  const t = useT();
  const { navigate, setAuthModal } = useApp();
  const { data: session } = useSession();

  const cols: { title: string; links: { label: string; action: () => void }[] }[] = [
    {
      title: t("footer.product"),
      links: [
        { label: t("nav.services"), action: () => navigate("services") },
        { label: t("nav.agents"), action: () => navigate("agents") },
        { label: t("nav.pricing"), action: () => navigate("pricing") },
        { label: t("nav.useCases"), action: () => navigate("useCases") },
      ],
    },
    {
      title: t("footer.company"),
      links: [
        { label: t("nav.about"), action: () => navigate("about") },
        { label: t("nav.contact"), action: () => navigate("contact") },
        { label: "Careers", action: () => navigate("about") },
        { label: "Blog", action: () => navigate("about") },
      ],
    },
    {
      title: t("footer.resources"),
      links: [
        { label: "Documentation", action: () => navigate("about") },
        { label: "API Reference", action: () => navigate("about") },
        { label: "Agent Guide", action: () => navigate("agents") },
        { label: "Community", action: () => navigate("contact") },
      ],
    },
    {
      title: t("footer.legal"),
      links: [
        { label: "Privacy Policy", action: () => navigate("about") },
        { label: "Terms of Service", action: () => navigate("about") },
        { label: "Cookie Policy", action: () => navigate("about") },
        { label: "GDPR", action: () => navigate("about") },
      ],
    },
  ];

  return (
    <footer className="relative mt-32 border-t border-purple-500/10 bg-black/20 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-6">
          {/* Brand */}
          <div className="col-span-2 md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold">
                Mianx<span className="gradient-text">.ai</span>
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-4 max-w-xs">
              {t("footer.tagline")}
            </p>
            <div className="flex gap-2">
              {[Twitter, Github, Linkedin, Mail].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="flex h-8 w-8 items-center justify-center rounded-md glass hover:bg-purple-500/20 transition-colors"
                  onClick={(e) => e.preventDefault()}
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {cols.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold mb-3">{col.title}</h4>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <button
                      onClick={link.action}
                      className="text-sm text-muted-foreground hover:text-purple-300 transition-colors text-left"
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-purple-500/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Mianx.ai. {t("footer.rights")}
          </p>
          <button
            onClick={() => {
              if (session?.user) {
                navigate("dashboard");
              } else {
                setAuthModal("signup");
              }
            }}
            className="text-xs text-purple-300 hover:text-purple-200 transition-colors"
          >
            {t("nav.signup")} →
          </button>
        </div>
      </div>
    </footer>
  );
}
