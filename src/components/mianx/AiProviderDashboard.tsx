"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Activity,
  DollarSign,
  Zap,
  Cpu,
  Clock,
  TrendingUp,
} from "lucide-react";

interface Provider {
  name: string;
  displayName: string;
  envKeyName: string;
  apiKeySet: boolean;
  enabled: boolean;
  priority: number;
  usedUsd: number;
  freeLimitUsd: number;
  remainingUsd: number;
  percentUsed: number;
  quotaExceeded: boolean;
  stats: {
    totalCalls: number;
    successCalls: number;
    failedCalls: number;
    totalTokens: number;
    totalCostUsd: number;
  };
}

interface UsageLog {
  id: string;
  provider: string;
  endpoint: string;
  agentName: string | null;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  status: string;
  errorMessage: string | null;
  responseTimeMs: number | null;
  createdAt: string;
}

interface AiUsageData {
  providers: Provider[];
  recentLogs: UsageLog[];
  summary: {
    totalProviders: number;
    activeProviders: number;
    totalUsedUsd: number;
    totalFreeUsd: number;
    totalRemainingUsd: number;
    totalCalls: number;
  };
}

const PROVIDER_ICONS: Record<string, typeof Zap> = {
  zai: Zap,
  gemini: Cpu,
  groq: Activity,
  openai: TrendingUp,
  anthropic: Cpu,
};

const STATUS_COLORS: Record<string, string> = {
  success: "bg-green-500/20 text-green-300",
  failed: "bg-red-500/20 text-red-300",
  rate_limited: "bg-amber-500/20 text-amber-300",
  quota_exceeded: "bg-orange-500/20 text-orange-300",
};

export function AiProviderDashboard() {
  const [data, setData] = useState<AiUsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    fetch("/api/admin/ai-usage")
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || `HTTP ${r.status}`);
        setData(json);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // Use a flag to avoid setState after unmount
    let mounted = true;
    fetch("/api/admin/ai-usage")
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || `HTTP ${r.status}`);
        if (mounted) {
          setData(json);
          setError(null);
        }
      })
      .catch((e) => {
        if (mounted) setError(e.message);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="glass border-purple-500/10 p-6">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-400 mb-2" />
          <p className="text-sm text-muted-foreground mb-3">
            {error || "Failed to load AI usage data"}
          </p>
          <Button onClick={loadData} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-3 w-3" />
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with summary */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Cpu className="h-5 w-5 text-purple-400" />
            AI Providers Dashboard
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Multi-provider AI with automatic fallback • {data.summary.activeProviders} of {data.summary.totalProviders} providers active
          </p>
        </div>
        <Button onClick={loadData} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-3 w-3" />
          Refresh
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="glass border-purple-500/10 p-4">
          <DollarSign className="h-4 w-4 text-green-400 mb-2" />
          <div className="text-xl font-bold text-green-400">
            ${data.summary.totalRemainingUsd.toFixed(2)}
          </div>
          <div className="text-xs text-muted-foreground">Free Credits Left</div>
        </Card>
        <Card className="glass border-purple-500/10 p-4">
          <DollarSign className="h-4 w-4 text-amber-400 mb-2" />
          <div className="text-xl font-bold">${data.summary.totalUsedUsd.toFixed(4)}</div>
          <div className="text-xs text-muted-foreground">Total Used</div>
        </Card>
        <Card className="glass border-purple-500/10 p-4">
          <Activity className="h-4 w-4 text-purple-400 mb-2" />
          <div className="text-xl font-bold">{data.summary.totalCalls}</div>
          <div className="text-xs text-muted-foreground">API Calls</div>
        </Card>
        <Card className="glass border-purple-500/10 p-4">
          <Zap className="h-4 w-4 text-cyan-400 mb-2" />
          <div className="text-xl font-bold">{data.summary.activeProviders}</div>
          <div className="text-xs text-muted-foreground">Active Providers</div>
        </Card>
      </div>

      {/* Provider cards */}
      <div>
        <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
          Provider Status (by priority)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.providers.map((provider) => {
            const Icon = PROVIDER_ICONS[provider.name] || Cpu;
            return (
              <Card
                key={provider.name}
                className={`glass p-5 ${
                  provider.quotaExceeded
                    ? "border-red-500/30"
                    : provider.apiKeySet
                      ? "border-green-500/20"
                      : "border-purple-500/10 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        provider.apiKeySet
                          ? "bg-gradient-to-br from-purple-500 to-cyan-500"
                          : "bg-muted"
                      }`}
                    >
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="font-semibold">{provider.displayName}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {provider.envKeyName}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="outline" className="text-xs">
                      Priority {provider.priority}
                    </Badge>
                    {provider.apiKeySet ? (
                      <Badge className="bg-green-500/20 text-green-300 text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    ) : (
                      <Badge className="bg-gray-500/20 text-gray-300 text-xs">
                        <XCircle className="h-3 w-3 mr-1" />
                        No Key
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Usage bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Free Credits Used</span>
                    <span className="font-mono">
                      ${provider.usedUsd.toFixed(4)} / ${provider.freeLimitUsd.toFixed(2)}
                    </span>
                  </div>
                  <Progress
                    value={provider.percentUsed}
                    className={`h-2 ${
                      provider.percentUsed > 80
                        ? "[&>div]:bg-red-500"
                        : provider.percentUsed > 50
                          ? "[&>div]:bg-amber-500"
                          : "[&>div]:bg-green-500"
                    }`}
                  />
                  <div className="flex items-center justify-between text-xs mt-1">
                    <span className="text-muted-foreground">
                      {provider.percentUsed.toFixed(1)}% used
                    </span>
                    <span className="text-green-400">
                      ${provider.remainingUsd.toFixed(2)} remaining
                    </span>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="glass rounded p-2">
                    <div className="text-sm font-bold">
                      {provider.stats.totalCalls}
                    </div>
                    <div className="text-xs text-muted-foreground">Calls</div>
                  </div>
                  <div className="glass rounded p-2">
                    <div className="text-sm font-bold text-green-400">
                      {provider.stats.successCalls}
                    </div>
                    <div className="text-xs text-muted-foreground">Success</div>
                  </div>
                  <div className="glass rounded p-2">
                    <div className="text-sm font-bold text-red-400">
                      {provider.stats.failedCalls}
                    </div>
                    <div className="text-xs text-muted-foreground">Failed</div>
                  </div>
                </div>

                {provider.quotaExceeded && (
                  <div className="mt-3 p-2 rounded-md bg-red-500/10 text-xs text-red-300">
                    ⚠️ Quota exceeded — will skip to next provider
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Recent logs */}
      <div>
        <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
          Recent API Calls (last 50)
        </h3>
        <Card className="glass border-purple-500/10 p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="glass-strong">
                <tr>
                  <th className="text-left p-3 font-medium text-xs text-muted-foreground">Time</th>
                  <th className="text-left p-3 font-medium text-xs text-muted-foreground">Provider</th>
                  <th className="text-left p-3 font-medium text-xs text-muted-foreground">Endpoint</th>
                  <th className="text-left p-3 font-medium text-xs text-muted-foreground">Agent</th>
                  <th className="text-right p-3 font-medium text-xs text-muted-foreground">Tokens</th>
                  <th className="text-right p-3 font-medium text-xs text-muted-foreground">Cost</th>
                  <th className="text-left p-3 font-medium text-xs text-muted-foreground">Status</th>
                  <th className="text-right p-3 font-medium text-xs text-muted-foreground">Time</th>
                </tr>
              </thead>
              <tbody>
                {data.recentLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-muted-foreground">
                      No API calls yet. Create a project and chat with agents to see usage here.
                    </td>
                  </tr>
                ) : (
                  data.recentLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-t border-purple-500/10 hover:bg-purple-500/5"
                    >
                      <td className="p-3 text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="p-3 font-medium">{log.provider}</td>
                      <td className="p-3 text-xs">{log.endpoint}</td>
                      <td className="p-3 text-xs">{log.agentName || "—"}</td>
                      <td className="p-3 text-right font-mono text-xs">
                        {log.totalTokens}
                      </td>
                      <td className="p-3 text-right font-mono text-xs">
                        ${log.costUsd.toFixed(4)}
                      </td>
                      <td className="p-3">
                        <Badge
                          className={`text-xs ${STATUS_COLORS[log.status] || "bg-gray-500/20 text-gray-300"}`}
                        >
                          {log.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-right text-xs text-muted-foreground">
                        {log.responseTimeMs ? `${log.responseTimeMs}ms` : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Setup instructions */}
      <Card className="glass border-purple-500/10 p-5">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Zap className="h-4 w-4 text-purple-400" />
          How to Enable More Providers
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <span className="text-purple-400">1.</span>
            <div>
              <strong>Z.ai (Free $18 credits):</strong> Sign up at{" "}
              <code className="text-purple-300">z.ai</code>, get API key, set{" "}
              <code className="text-purple-300">ZAI_API_KEY</code> in Vercel env vars
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-purple-400">2.</span>
            <div>
              <strong>Google Gemini (Free tier):</strong> Sign up at{" "}
              <code className="text-purple-300">ai.google.dev</code>, get API key, set{" "}
              <code className="text-purple-300">GEMINI_API_KEY</code>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-purple-400">3.</span>
            <div>
              <strong>Groq (Free, fast):</strong> Sign up at{" "}
              <code className="text-purple-300">console.groq.com</code>, get API key, set{" "}
              <code className="text-purple-300">GROQ_API_KEY</code>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-purple-400">4.</span>
            <div>
              <strong>OpenAI ($5 free):</strong> Sign up at{" "}
              <code className="text-purple-300">platform.openai.com</code>, set{" "}
              <code className="text-purple-300">OPENAI_API_KEY</code>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-purple-400">5.</span>
            <div>
              <strong>Anthropic ($5 free):</strong> Sign up at{" "}
              <code className="text-purple-300">console.anthropic.com</code>, set{" "}
              <code className="text-purple-300">ANTHROPIC_API_KEY</code>
            </div>
          </div>
        </div>
        <div className="mt-3 p-3 rounded-md bg-purple-500/10 text-xs text-purple-200">
          💡 <strong>Tip:</strong> Add multiple providers for automatic fallback.
          When one&apos;s quota is exceeded, the system automatically switches to the next.
        </div>
      </Card>
    </div>
  );
}
