"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Building2,
  Globe,
  MapPin,
  Save,
  Loader2,
  ArrowLeft,
  Palette,
  Clock,
  Shield,
  Archive,
  Check,
} from "lucide-react";
import { motion } from "framer-motion";

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Australia/Sydney",
];

const LOCALES = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "es-ES", label: "Spanish" },
  { value: "fr-FR", label: "French" },
  { value: "de-DE", label: "German" },
  { value: "ja-JP", label: "Japanese" },
  { value: "zh-CN", label: "Chinese (Simplified)" },
  { value: "ar-SA", label: "Arabic" },
  { value: "hi-IN", label: "Hindi" },
  { value: "ur-PK", label: "Urdu" },
];

const CURRENCIES = [
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "GBP", label: "GBP (£)" },
  { value: "JPY", label: "JPY (¥)" },
  { value: "CNY", label: "CNY (¥)" },
  { value: "PKR", label: "PKR (₨)" },
  { value: "AED", label: "AED (د.إ)" },
  { value: "INR", label: "INR (₹)" },
];

interface OrgData {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  locale: string;
  currency: string;
  status: string;
  brandColor: string;
  logoUrl: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
}

export function OrgSettingsView() {
  const { activeOrgId, activeOrgPermissions, navigate } = useApp();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [org, setOrg] = useState<OrgData | null>(null);

  const hasManagePermission = activeOrgPermissions.includes("core.org.manage");

  useEffect(() => {
    if (!activeOrgId) return;
    fetchOrg();
  }, [activeOrgId]);

  async function fetchOrg() {
    if (!activeOrgId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/organizations/${activeOrgId}`);
      if (res.ok) {
        const data = await res.json();
        setOrg(data.organization || null);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!activeOrgId || !org) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch(`/api/organizations/${activeOrgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: org.name,
          slug: org.slug,
          timezone: org.timezone,
          locale: org.locale,
          currency: org.currency,
        }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch {
      // Silently fail
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!activeOrgId) return;
    const confirmed = window.confirm(
      "Are you sure you want to archive this organization? This action will deactivate all domains and services under this organization.",
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/organizations/${activeOrgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ARCHIVED" }),
      });
      if (res.ok) {
        navigate("organizations");
      }
    } catch {
      // Silently fail
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("organizations")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="h-8 w-64 glass rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-96 glass rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("organizations")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Organization Not Found</h1>
        </div>
        <Card className="glass border-purple-500/10 p-8 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            The selected organization could not be loaded. It may have been deleted or you don&apos;t have access.
          </p>
        </Card>
      </div>
    );
  }

  const isDisabled = !hasManagePermission;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("organizations")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">
            <span className="gradient-text">{org.name}</span> Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your organization configuration
          </p>
        </div>
      </div>

      {!hasManagePermission && (
        <Card className="glass border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <Shield className="h-5 w-5 text-amber-400 flex-shrink-0" />
            <p className="text-sm text-amber-300">
              You have read-only access. Contact your organization owner or admin to make changes.
            </p>
          </CardContent>
        </Card>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="glass border-purple-500/10 bg-purple-500/5">
            <TabsTrigger value="general" className="data-[state=active]:bg-purple-500/15 data-[state=active]:text-purple-300">
              <Building2 className="mr-2 h-4 w-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="brand" className="data-[state=active]:bg-purple-500/15 data-[state=active]:text-purple-300">
              <Palette className="mr-2 h-4 w-4" />
              Brand & Location
            </TabsTrigger>
            <TabsTrigger value="danger" className="data-[state=active]:bg-red-500/15 data-[state=active]:text-red-300">
              <AlertTriangle className="mr-2 h-4 w-4" />
              Danger Zone
            </TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="space-y-6">
            <Card className="glass border-purple-500/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-purple-400" />
                  Organization Details
                </CardTitle>
                <CardDescription>
                  Basic information about your organization
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="org-name">Organization Name</Label>
                    <Input
                      id="org-name"
                      value={org.name}
                      onChange={(e) => setOrg({ ...org, name: e.target.value })}
                      disabled={isDisabled}
                      className="bg-purple-500/5 border-purple-500/10 focus:border-purple-500/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="org-slug">Slug</Label>
                    <Input
                      id="org-slug"
                      value={org.slug}
                      onChange={(e) => setOrg({ ...org, slug: e.target.value })}
                      disabled={isDisabled}
                      className="bg-purple-500/5 border-purple-500/10 focus:border-purple-500/30"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Unique identifier used in URLs and API references
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="org-timezone">Timezone</Label>
                    <Select
                      value={org.timezone}
                      onValueChange={(v) => setOrg({ ...org, timezone: v })}
                      disabled={isDisabled}
                    >
                      <SelectTrigger className="bg-purple-500/5 border-purple-500/10">
                        <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONES.map((tz) => (
                          <SelectItem key={tz} value={tz}>
                            {tz}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="org-locale">Locale</Label>
                    <Select
                      value={org.locale}
                      onValueChange={(v) => setOrg({ ...org, locale: v })}
                      disabled={isDisabled}
                    >
                      <SelectTrigger className="bg-purple-500/5 border-purple-500/10">
                        <Globe className="mr-2 h-4 w-4 text-muted-foreground" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LOCALES.map((loc) => (
                          <SelectItem key={loc.value} value={loc.value}>
                            {loc.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="org-currency">Currency</Label>
                    <Select
                      value={org.currency}
                      onValueChange={(v) => setOrg({ ...org, currency: v })}
                      disabled={isDisabled}
                    >
                      <SelectTrigger className="bg-purple-500/5 border-purple-500/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((cur) => (
                          <SelectItem key={cur.value} value={cur.value}>
                            {cur.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    onClick={handleSave}
                    disabled={isDisabled || saving}
                    className="btn-gradient text-white"
                  >
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : saveSuccess ? (
                      <Check className="mr-2 h-4 w-4" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    {saveSuccess ? "Saved!" : "Save Changes"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Brand & Location Tab */}
          <TabsContent value="brand" className="space-y-6">
            <Card className="glass border-purple-500/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5 text-purple-400" />
                  Branding
                </CardTitle>
                <CardDescription>
                  Customize your organization&apos;s visual identity
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="brand-color">Brand Color</Label>
                    <div className="flex gap-2">
                      <Input
                        id="brand-color"
                        value={org.brandColor}
                        onChange={(e) => setOrg({ ...org, brandColor: e.target.value })}
                        disabled={isDisabled}
                        className="bg-purple-500/5 border-purple-500/10 focus:border-purple-500/30"
                      />
                      <div
                        className="h-10 w-10 rounded-md border border-purple-500/10 flex-shrink-0"
                        style={{ backgroundColor: org.brandColor }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      value={org.website || ""}
                      onChange={(e) => setOrg({ ...org, website: e.target.value })}
                      disabled={isDisabled}
                      placeholder="https://example.com"
                      className="bg-purple-500/5 border-purple-500/10 focus:border-purple-500/30"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <Button
                    onClick={handleSave}
                    disabled={isDisabled || saving}
                    className="btn-gradient text-white"
                  >
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : saveSuccess ? (
                      <Check className="mr-2 h-4 w-4" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    {saveSuccess ? "Saved!" : "Save Changes"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="glass border-purple-500/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-purple-400" />
                  Location
                </CardTitle>
                <CardDescription>
                  Your organization&apos;s physical location
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={org.address || ""}
                    onChange={(e) => setOrg({ ...org, address: e.target.value })}
                    disabled={isDisabled}
                    placeholder="123 Business Street"
                    className="bg-purple-500/5 border-purple-500/10 focus:border-purple-500/30"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={org.city || ""}
                      onChange={(e) => setOrg({ ...org, city: e.target.value })}
                      disabled={isDisabled}
                      placeholder="San Francisco"
                      className="bg-purple-500/5 border-purple-500/10 focus:border-purple-500/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={org.country || ""}
                      onChange={(e) => setOrg({ ...org, country: e.target.value })}
                      disabled={isDisabled}
                      placeholder="United States"
                      className="bg-purple-500/5 border-purple-500/10 focus:border-purple-500/30"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <Button
                    onClick={handleSave}
                    disabled={isDisabled || saving}
                    className="btn-gradient text-white"
                  >
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : saveSuccess ? (
                      <Check className="mr-2 h-4 w-4" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    {saveSuccess ? "Saved!" : "Save Changes"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Danger Zone Tab */}
          <TabsContent value="danger" className="space-y-6">
            <Card className="glass border-red-500/20 bg-red-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-400">
                  <AlertTriangle className="h-5 w-5" />
                  Danger Zone
                </CardTitle>
                <CardDescription className="text-red-300/70">
                  Irreversible and destructive actions for your organization
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border border-red-500/20 bg-red-500/5">
                  <div>
                    <h4 className="font-semibold text-sm">Archive Organization</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Permanently archive this organization and all its data. This action cannot be undone.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleArchive}
                    disabled={!hasManagePermission}
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  >
                    <Archive className="mr-1.5 h-3 w-3" />
                    Archive
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
