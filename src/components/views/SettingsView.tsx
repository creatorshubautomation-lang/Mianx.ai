"use client";

import { useEffect, useState } from "react";
import { useApp, useT } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LANGS } from "@/lib/i18n";
import { useSession } from "next-auth/react";
import {
  User,
  Mail,
  Building2,
  Phone,
  Globe,
  Save,
  Loader2,
  Shield,
  CreditCard,
  Crown,
} from "lucide-react";
import { toast } from "sonner";

interface UserData {
  id: string;
  email: string;
  name: string;
  role: string;
  company: string | null;
  phone: string | null;
  avatarUrl: string | null;
  preferredLang: string;
  plan: string;
  createdAt: string;
}

export function SettingsView() {
  const t = useT();
  const { lang, setLang } = useApp();
  const { data: session } = useSession();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    company: "",
    phone: "",
    preferredLang: "en",
  });

  useEffect(() => {
    fetch("/api/session")
      .then(async (r) => {
        const data = await r.json();
        if (data.user) {
          setUser(data.user);
          setForm({
            name: data.user.name || "",
            company: data.user.company || "",
            phone: data.user.phone || "",
            preferredLang: data.user.preferredLang || "en",
          });
          if (data.warning) {
            console.warn("[settings] DB warning:", data.warning);
          }
        } else {
          console.error("[settings] no user in response:", data);
        }
        setLoading(false);
      })
      .catch((e) => {
        console.error("[settings] fetch error:", e);
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.ok) {
        setUser(data.user);
        setLang(form.preferredLang as "en" | "ur" | "roman");
        toast.success(t("settings.saved"));
      } else {
        toast.error("Failed to save changes");
      }
    } catch {
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
      </div>
    );
  }

  if (!user) {
    return <div className="text-center py-20">Failed to load profile.</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">{t("settings.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account, language, and preferences.
        </p>
      </div>

      {/* Profile */}
      <Card className="glass border-purple-500/10 p-6">
        <div className="flex items-center gap-2 mb-5">
          <User className="h-5 w-5 text-purple-400" />
          <h2 className="font-semibold">{t("settings.profile")}</h2>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="pl-9 glass"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  value={user.email}
                  disabled
                  className="pl-9 glass opacity-60"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="company"
                  value={form.company}
                  onChange={(e) =>
                    setForm({ ...form, company: e.target.value })
                  }
                  placeholder="Acme Inc."
                  className="pl-9 glass"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+1 234 567 890"
                  className="pl-9 glass"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("settings.language")}</Label>
            <div className="grid grid-cols-3 gap-2">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  onClick={() =>
                    setForm({ ...form, preferredLang: l.code })
                  }
                  className={`flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all border ${
                    form.preferredLang === l.code
                      ? "border-purple-500/40 bg-purple-500/10 text-purple-300"
                      : "border-purple-500/10 glass hover:border-purple-500/30"
                  }`}
                >
                  <Globe className="h-4 w-4" />
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="btn-gradient text-white"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {t("settings.save")}
          </Button>
        </div>
      </Card>

      {/* Account info */}
      <Card className="glass border-purple-500/10 p-6">
        <div className="flex items-center gap-2 mb-5">
          <Shield className="h-5 w-5 text-purple-400" />
          <h2 className="font-semibold">Account</h2>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Role</span>
            <Badge variant="outline" className="glass">
              {user.role}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Member since</span>
            <span className="text-sm">
              {new Date(user.createdAt).toLocaleDateString()}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Current plan</span>
            <Badge className="bg-gradient-to-r from-purple-500 to-cyan-500">
              <Crown className="h-3 w-3 mr-1" />
              {user.plan}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Billing */}
      <Card className="glass border-purple-500/10 p-6">
        <div className="flex items-center gap-2 mb-5">
          <CreditCard className="h-5 w-5 text-purple-400" />
          <h2 className="font-semibold">{t("settings.billing")}</h2>
        </div>
        <div className="text-center py-6">
          <Crown className="mx-auto h-10 w-10 text-purple-400 mb-2" />
          <p className="text-sm text-muted-foreground mb-3">
            You&apos;re on the {user.plan} plan. Upgrade for more agents and projects.
          </p>
          <Button
            variant="outline"
            className="glass"
            onClick={() => useApp.getState().navigate("pricing")}
          >
            View Plans
          </Button>
        </div>
      </Card>
    </div>
  );
}
