"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Globe } from "lucide-react";

interface DomainItem {
  slug: string;
  name: string;
  icon: string;
  status: string;
}

export function DomainNav() {
  const { activeOrgId, activeDomainSlug, setActiveDomainSlug } = useApp();
  const [domains, setDomains] = useState<DomainItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeOrgId) {
      setDomains([]);
      setActiveDomainSlug(null);
      return;
    }

    fetchDomains();
  }, [activeOrgId]);

  async function fetchDomains() {
    if (!activeOrgId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/organizations/${activeOrgId}/domains`);
      if (res.ok) {
        const data = await res.json();
        const activated: DomainItem[] = (data.domains || []).filter(
          (d: DomainItem) => d.status === "ACTIVE",
        );
        setDomains(activated);

        // Auto-select first domain if none selected
        if (!activeDomainSlug && activated.length > 0) {
          setActiveDomainSlug(activated[0].slug);
        }
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }

  // Don't render if no org selected or no domains
  if (!activeOrgId) return null;
  if (loading && domains.length === 0) return null;
  if (domains.length === 0) return null;

  return (
    <div className="px-3 pb-2">
      <Tabs
        value={activeDomainSlug || ""}
        onValueChange={(val) => setActiveDomainSlug(val || null)}
      >
        <TabsList className="w-full h-auto bg-purple-500/5 border border-purple-500/10 p-1">
          {domains.map((domain) => (
            <TabsTrigger
              key={domain.slug}
              value={domain.slug}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium data-[state=active]:bg-purple-500/15 data-[state=active]:text-purple-300 data-[state=active]:shadow-none flex-1 justify-center"
            >
              <Globe className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{domain.name}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
