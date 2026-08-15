"use client";

import { useApp } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Code2,
  Copy,
  Check,
  Webhook,
  Key,
  Zap,
  FileText,
  Shield,
  Terminal,
  BookOpen,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ApiEndpoint {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  description: string;
  auth: boolean;
  example?: string;
  responseExample?: string;
}

const ENDPOINTS: ApiEndpoint[] = [
  // Auth
  {
    method: "POST",
    path: "/api/auth/register",
    description: "Create a new user account. First user becomes ADMIN.",
    auth: false,
    example: `{
  "email": "user@example.com",
  "password": "mypassword",
  "name": "John Doe",
  "company": "Acme Inc."
}`,
    responseExample: `{
  "user": {
    "id": "cuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "CLIENT"
  },
  "ok": true
}`,
  },
  {
    method: "POST",
    path: "/api/auth/forgot-password",
    description: "Send password reset email",
    auth: false,
    example: `{ "email": "user@example.com" }`,
    responseExample: `{ "ok": true, "message": "If account exists, email sent." }`,
  },
  {
    method: "POST",
    path: "/api/auth/reset-password",
    description: "Reset password using token from email",
    auth: false,
    example: `{
  "token": "reset-token-from-email",
  "newPassword": "newpassword123"
}`,
  },
  // Session
  {
    method: "GET",
    path: "/api/session",
    description: "Get current user's session info",
    auth: true,
    responseExample: `{
  "user": {
    "id": "cuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "CLIENT",
    "plan": "FREE"
  }
}`,
  },
  // Projects
  {
    method: "GET",
    path: "/api/projects",
    description: "List all projects for current user (admin sees all)",
    auth: true,
  },
  {
    method: "GET",
    path: "/api/projects?id={projectId}",
    description: "Get a specific project with agents, tasks, messages, deliverables",
    auth: true,
  },
  {
    method: "POST",
    path: "/api/projects",
    description: "Create a new project. AI assigns agents + generates tasks.",
    auth: true,
    example: `{
  "title": "E-commerce Platform",
  "description": "Build a modern e-commerce site...",
  "projectType": "web",
  "priority": "normal",
  "recommendedAgents": ["Zen", "Aria", "Atlas"],
  "suggestedTasks": [...]
}`,
  },
  // Chat
  {
    method: "GET",
    path: "/api/chat?projectId={projectId}",
    description: "List all messages in a project chat",
    auth: true,
  },
  {
    method: "POST",
    path: "/api/chat",
    description: "Send a message + get multi-agent team response",
    auth: true,
    example: `{
  "projectId": "cuid",
  "content": "Build me a landing page"
}`,
    responseExample: `{
  "userMessage": {...},
  "agentMessages": [...],
  "teamSize": 2,
  "isTeamResponse": true
}`,
  },
  // Deliverables
  {
    method: "GET",
    path: "/api/deliverables?projectId={projectId}",
    description: "List all deliverables for a project",
    auth: true,
  },
  {
    method: "POST",
    path: "/api/deliverables",
    description: "Request AI agent to generate a deliverable",
    auth: true,
    example: `{
  "projectId": "cuid",
  "agentName": "Zen",
  "taskDescription": "Create React component for hero section"
}`,
  },
  // Tickets
  {
    method: "GET",
    path: "/api/tickets",
    description: "List current user's support tickets",
    auth: true,
  },
  {
    method: "POST",
    path: "/api/tickets",
    description: "Create a new support ticket",
    auth: true,
    example: `{
  "subject": "Payment issue",
  "description": "My card was charged twice...",
  "priority": "high",
  "category": "billing"
}`,
  },
  // Stripe
  {
    method: "POST",
    path: "/api/stripe/checkout",
    description: "Create Stripe checkout session for subscription",
    auth: true,
    example: `{
  "planId": "pro",
  "billing": "monthly"
}`,
    responseExample: `{ "url": "https://checkout.stripe.com/..." }`,
  },
  {
    method: "POST",
    path: "/api/stripe/webhook",
    description: "Stripe webhook receiver (no auth — Stripe calls this)",
    auth: false,
  },
  // Upload
  {
    method: "POST",
    path: "/api/upload",
    description: "Upload a file (max 5MB). Returns file info.",
    auth: true,
    example: `// FormData with:
// - file: File object
// - projectId: string`,
  },
  // Analytics
  {
    method: "GET",
    path: "/api/analytics",
    description: "Get client analytics (projects, tasks, activity)",
    auth: true,
  },
  // Health
  {
    method: "GET",
    path: "/api/health",
    description: "Health check endpoint (public — for monitoring)",
    auth: false,
    responseExample: `{
  "status": "ok",
  "checks": [
    { "name": "Database connection", "status": "ok" },
    { "name": "Agent seed data", "status": "ok" }
  ]
}`,
  },
];

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-green-500/20 text-green-300",
  POST: "bg-blue-500/20 text-blue-300",
  PATCH: "bg-amber-500/20 text-amber-300",
  DELETE: "bg-red-500/20 text-red-300",
};

export function ApiDocsView() {
  const { setAuthModal } = useApp();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="relative min-h-screen pt-24 pb-20">
      <div className="fixed inset-0 mesh-bg-soft -z-10" />

      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 mb-4 text-xs">
            <BookOpen className="h-3.5 w-3.5 text-purple-400" />
            <span className="text-muted-foreground">
              {ENDPOINTS.length} endpoints · REST API
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold">
            API <span className="gradient-text">Documentation</span>
          </h1>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Build integrations with Mianx.ai. REST API for projects, chat, deliverables, payments, and more.
          </p>
        </div>

        {/* Quick Start */}
        <Card className="glass border-purple-500/10 p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-5 w-5 text-purple-400" />
            <h2 className="font-semibold text-lg">Quick Start</h2>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Key className="h-4 w-4 text-amber-400" />
                Authentication
              </h3>
              <p className="text-sm text-muted-foreground mb-2">
                All authenticated endpoints require a valid session cookie. Sign in first, then make API calls.
              </p>
              <div className="glass rounded-md p-3 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground"># Cookie-based auth (automatic in browser)</span>
                  <button
                    onClick={() => copyToClipboard("// Cookie-based auth (automatic in browser)", "auth")}
                    className="text-purple-300 hover:text-purple-200"
                  >
                    {copied === "auth" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Terminal className="h-4 w-4 text-cyan-400" />
                Base URL
              </h3>
              <div className="glass rounded-md p-3 font-mono text-xs flex items-center justify-between">
                <span className="text-cyan-300">https://mianx-ai.vercel.app/api</span>
                <button
                  onClick={() => copyToClipboard("https://mianx-ai.vercel.app/api", "baseurl")}
                  className="text-purple-300 hover:text-purple-200"
                >
                  {copied === "baseurl" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Code2 className="h-4 w-4 text-green-400" />
                Example Request
              </h3>
              <div className="glass rounded-md p-3 font-mono text-xs overflow-x-auto">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-muted-foreground"># Create a project</span>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `fetch('/api/projects', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'My Project',
    description: 'Build a web app',
    projectType: 'web'
  })
})`,
                        "example",
                      )
                    }
                    className="text-purple-300 hover:text-purple-200"
                  >
                    {copied === "example" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
                <pre className="text-green-300">{`fetch('/api/projects', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'My Project',
    description: 'Build a web app',
    projectType: 'web'
  })
})`}</pre>
              </div>
            </div>
          </div>
        </Card>

        {/* Endpoints */}
        <div className="space-y-3">
          <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-400" />
            Endpoints
          </h2>

          {ENDPOINTS.map((endpoint, i) => (
            <Card
              key={`${endpoint.method}-${endpoint.path}`}
              className="glass border-purple-500/10 overflow-hidden"
            >
              <button
                onClick={() =>
                  setExpanded(
                    expanded === `${endpoint.method}-${endpoint.path}`
                      ? null
                      : `${endpoint.method}-${endpoint.path}`,
                  )
                }
                className="w-full p-4 flex items-center gap-3 hover:bg-purple-500/5 transition-colors text-left"
              >
                <Badge className={`${METHOD_COLORS[endpoint.method]} font-mono text-xs`}>
                  {endpoint.method}
                </Badge>
                <code className="text-sm font-mono flex-1">{endpoint.path}</code>
                {endpoint.auth && (
                  <span title="Requires auth"><Shield className="h-3 w-3 text-amber-400" /></span>
                )}
                <span className="text-xs text-muted-foreground hidden sm:block">
                  {endpoint.description.slice(0, 50)}
                  {endpoint.description.length > 50 ? "..." : ""}
                </span>
              </button>

              {expanded === `${endpoint.method}-${endpoint.path}` && (
                <div className="p-4 pt-0 border-t border-purple-500/10">
                  <p className="text-sm text-muted-foreground mb-3 mt-3">
                    {endpoint.description}
                  </p>

                  {endpoint.auth && (
                    <div className="mb-3 flex items-center gap-2">
                      <Badge className="bg-amber-500/20 text-amber-300 text-xs">
                        <Shield className="h-3 w-3 mr-1" />
                        Auth Required
                      </Badge>
                    </div>
                  )}

                  {endpoint.example && (
                    <div className="mb-3">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                        Request Body
                      </h4>
                      <div className="glass rounded-md p-3 font-mono text-xs overflow-x-auto relative">
                        <button
                          onClick={() =>
                            copyToClipboard(endpoint.example!, `${endpoint.path}-req`)
                          }
                          className="absolute top-2 right-2 text-purple-300 hover:text-purple-200"
                        >
                          {copied === `${endpoint.path}-req` ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                        <pre className="text-cyan-300">{endpoint.example}</pre>
                      </div>
                    </div>
                  )}

                  {endpoint.responseExample && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                        Response
                      </h4>
                      <div className="glass rounded-md p-3 font-mono text-xs overflow-x-auto relative">
                        <button
                          onClick={() =>
                            copyToClipboard(endpoint.responseExample!, `${endpoint.path}-res`)
                          }
                          className="absolute top-2 right-2 text-purple-300 hover:text-purple-200"
                        >
                          {copied === `${endpoint.path}-res` ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                        <pre className="text-green-300">{endpoint.responseExample}</pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>

        {/* Webhooks section */}
        <Card className="glass border-purple-500/10 p-6 mt-8">
          <div className="flex items-center gap-2 mb-4">
            <Webhook className="h-5 w-5 text-purple-400" />
            <h2 className="font-semibold text-lg">Webhooks</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Receive real-time notifications when events happen. Set{" "}
            <code className="text-purple-300">WEBHOOK_URL</code> environment variable
            to receive POST requests with event data.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              "project.created",
              "chat.agent_response",
              "deliverable.generated",
              "user.signup",
              "ticket.created",
              "subscription.activated",
            ].map((event) => (
              <div
                key={event}
                className="glass rounded-md p-2 text-xs font-mono text-purple-300"
              >
                {event}
              </div>
            ))}
          </div>
        </Card>

        {/* CTA */}
        <Card className="glass-strong border-purple-500/20 p-8 text-center mt-8">
          <h2 className="text-xl font-bold mb-2">Ready to build?</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Sign up free and start integrating with Mianx.ai API.
          </p>
          <Button
            onClick={() => setAuthModal("signup")}
            className="btn-gradient text-white"
          >
            Get API Access
          </Button>
        </Card>
      </div>
    </div>
  );
}
