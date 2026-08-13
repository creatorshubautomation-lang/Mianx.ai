"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useApp, useT } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentAvatar } from "../mianx/AgentAvatar";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Send,
  Loader2,
  FileBox,
  CheckCircle2,
  Circle,
  Clock,
  ListTodo,
  MessageSquare,
  Download,
  Sparkles,
  Bot,
  FileCode,
  FileText,
  Image as ImageIcon,
  ScrollText,
  PlusCircle,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";

interface Agent {
  id: string;
  name: string;
  role: string;
  icon: string;
  color: string;
  team: string;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  order: number;
  assignedAgentId: string | null;
}

interface Message {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  user?: { name: string; email: string } | null;
  agent?: { name: string; role: string; icon: string; color: string } | null;
}

interface Deliverable {
  id: string;
  title: string;
  description: string | null;
  fileType: string;
  content: string;
  fileName: string | null;
  createdAt: string;
  uploader: { name: string };
}

interface Project {
  id: string;
  title: string;
  description: string;
  projectType: string;
  status: string;
  priority: string;
  progress: number;
  budget: number | null;
  deadline: string | null;
  createdAt: string;
  agents: { agent: Agent; status: string; progress: number }[];
  tasks: Task[];
  messages: Message[];
  deliverables: Deliverable[];
  activities: { id: string; action: string; details: string | null; createdAt: string }[];
}

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  BRIEFING: { label: "Briefing", color: "bg-gray-500/20 text-gray-300" },
  PLANNING: { label: "Planning", color: "bg-blue-500/20 text-blue-300" },
  IN_PROGRESS: { label: "In Progress", color: "bg-purple-500/20 text-purple-300" },
  REVIEW: { label: "In Review", color: "bg-amber-500/20 text-amber-300" },
  DELIVERED: { label: "Delivered", color: "bg-cyan-500/20 text-cyan-300" },
  COMPLETED: { label: "Completed", color: "bg-green-500/20 text-green-300" },
  ON_HOLD: { label: "On Hold", color: "bg-orange-500/20 text-orange-300" },
  CANCELLED: { label: "Cancelled", color: "bg-red-500/20 text-red-300" },
};

const FILE_ICONS: Record<string, typeof FileCode> = {
  code: FileCode,
  document: FileText,
  design: ImageIcon,
  report: ScrollText,
  archive: FileBox,
};

export function ProjectDetail() {
  const t = useT();
  const { selectedProjectId, setView } = useApp();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const [requestingDeliverable, setRequestingDeliverable] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadProject = useCallback(async () => {
    if (!selectedProjectId) return;
    try {
      const res = await fetch(`/api/projects?id=${selectedProjectId}`);
      const data = await res.json();
      if (data.project) {
        setProject(data.project);
      } else {
        toast.error("Project not found");
        setView("projects");
      }
    } catch {
      toast.error("Failed to load project");
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, setView]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [project?.messages.length]);

  const handleSend = async () => {
    if (!chatInput.trim() || !project) return;
    const content = chatInput.trim();
    setChatInput("");
    setSending(true);

    // Optimistic: add user message immediately
    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
      user: { name: "You", email: "" },
    };
    setProject((p) =>
      p ? { ...p, messages: [...p.messages, optimisticMsg] } : p,
    );

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, content }),
      });
      const data = await res.json();
      if (data.userMessage && data.agentMessage) {
        setProject((p) =>
          p
            ? {
                ...p,
                messages: [
                  ...p.messages.filter((m) => m.id !== optimisticMsg.id),
                  data.userMessage,
                  data.agentMessage,
                ],
              }
            : p,
        );
      } else {
        toast.error(data.error || "Failed to send message");
        // Remove optimistic message on error
        setProject((p) =>
          p
            ? {
                ...p,
                messages: p.messages.filter((m) => m.id !== optimisticMsg.id),
              }
            : p,
        );
      }
    } catch {
      toast.error("Failed to send message");
      setProject((p) =>
        p
          ? {
              ...p,
              messages: p.messages.filter((m) => m.id !== optimisticMsg.id),
            }
          : p,
      );
    } finally {
      setSending(false);
    }
  };

  const handleRequestDeliverable = async (agentName: string) => {
    if (!project) return;
    setRequestingDeliverable(true);
    try {
      const taskDesc = `Generate a complete deliverable for: ${project.title}. Project type: ${project.projectType}. Description: ${project.description}`;
      const res = await fetch("/api/deliverables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          agentName,
          taskDescription: taskDesc,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(`${agentName} generated a deliverable!`);
        loadProject(); // reload to show new deliverable
      } else {
        toast.error(data.error || "Failed to generate deliverable");
      }
    } catch {
      toast.error("Failed to generate deliverable");
    } finally {
      setRequestingDeliverable(false);
    }
  };

  const handleDownload = (deliverable: Deliverable) => {
    const blob = new Blob([deliverable.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = deliverable.fileName || `${deliverable.title}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Downloaded!");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Project not found.</p>
        <Button onClick={() => setView("projects")} className="mt-4">
          Back to Projects
        </Button>
      </div>
    );
  }

  const statusInfo = STATUS_BADGES[project.status] || STATUS_BADGES.IN_PROGRESS;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setView("projects")}
          className="mb-3 text-xs"
        >
          <ArrowLeft className="mr-1 h-3 w-3" />
          Back to Projects
        </Button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl sm:text-3xl font-bold">{project.title}</h1>
              <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {project.description}
            </p>
          </div>
        </div>
      </div>

      {/* Agent team bar */}
      <Card className="glass border-purple-500/10 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">
            {t("project.agents")} ({project.agents.length})
          </h3>
          <Badge variant="outline" className="text-xs glass">
            {project.agents.filter((a) => a.status === "working").length}{" "}
            working now
          </Badge>
        </div>
        <div className="flex flex-wrap gap-3">
          {project.agents.map((a) => (
            <div
              key={a.agent.id}
              className="flex items-center gap-2 glass rounded-lg p-2 pr-3"
            >
              <AgentAvatar
                name={a.agent.name}
                icon={a.agent.icon}
                color={a.agent.color}
                size="md"
                status={a.status as "working" | "assigned" | "waiting" | "done" | "paused"}
              />
              <div>
                <div className="text-sm font-medium">{a.agent.name}</div>
                <div className="text-xs text-muted-foreground">
                  {a.agent.role}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Progress value={project.progress} className="h-2 flex-1" />
          <span className="text-xs text-muted-foreground">
            {project.progress}% {t("project.progress").toLowerCase()}
          </span>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="chat">
        <TabsList className="grid w-full grid-cols-4 glass">
          <TabsTrigger value="chat" className="text-xs sm:text-sm">
            <MessageSquare className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">{t("project.chat")}</span>
          </TabsTrigger>
          <TabsTrigger value="tasks" className="text-xs sm:text-sm">
            <ListTodo className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">{t("project.tasks")}</span>
            <span className="ml-1 text-xs">({project.tasks.length})</span>
          </TabsTrigger>
          <TabsTrigger value="deliverables" className="text-xs sm:text-sm">
            <FileBox className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">{t("project.deliverables")}</span>
            <span className="ml-1 text-xs">({project.deliverables.length})</span>
          </TabsTrigger>
          <TabsTrigger value="activity" className="text-xs sm:text-sm">
            <Clock className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">{t("project.activity")}</span>
          </TabsTrigger>
        </TabsList>

        {/* CHAT */}
        <TabsContent value="chat">
          <Card className="glass border-purple-500/10 h-[600px] flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {project.messages.length === 0 ? (
                <div className="text-center py-12">
                  <Bot className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {t("project.noMessages")}
                  </p>
                </div>
              ) : (
                project.messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-3 ${
                      msg.role === "user" ? "flex-row-reverse" : ""
                    }`}
                  >
                    {msg.role === "agent" && msg.agent ? (
                      <AgentAvatar
                        name={msg.agent.name}
                        icon={msg.agent.icon}
                        color={msg.agent.color}
                        size="sm"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 text-xs font-medium text-white flex-shrink-0">
                        {(msg.user?.name || "U").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div
                      className={`flex-1 max-w-[80%] ${
                        msg.role === "user" ? "text-right" : ""
                      }`}
                    >
                      <div
                        className={`inline-block text-left rounded-lg p-3 ${
                          msg.role === "user"
                            ? "bg-purple-500/20 text-foreground"
                            : "glass"
                        }`}
                      >
                        {msg.role === "agent" && msg.agent && (
                          <div className="text-xs text-purple-300 mb-1 font-medium">
                            {msg.agent.name} · {msg.agent.role}
                          </div>
                        )}
                        <div className="text-sm markdown-content">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
              {sending && (
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                  </div>
                  <div className="glass rounded-lg p-3">
                    <span className="text-sm text-muted-foreground">
                      Agent is typing...
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-purple-500/10">
              <div className="flex gap-2">
                <Textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={t("project.sendMessage")}
                  rows={2}
                  className="glass resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <Button
                  onClick={handleSend}
                  disabled={!chatInput.trim() || sending}
                  className="btn-gradient text-white self-end"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* TASKS */}
        <TabsContent value="tasks">
          <Card className="glass border-purple-500/10 p-4">
            {project.tasks.length === 0 ? (
              <div className="text-center py-12">
                <ListTodo className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {t("project.noTasks")}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {project.tasks.map((task) => {
                  const agent = project.agents.find(
                    (a) => a.agent.id === task.assignedAgentId,
                  );
                  const TaskIcon =
                    task.status === "done"
                      ? CheckCircle2
                      : task.status === "in_progress"
                        ? Clock
                        : Circle;
                  return (
                    <div
                      key={task.id}
                      className="glass rounded-lg p-3 flex items-start gap-3"
                    >
                      <TaskIcon
                        className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
                          task.status === "done"
                            ? "text-green-400"
                            : task.status === "in_progress"
                              ? "text-amber-400"
                              : "text-muted-foreground"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{task.title}</div>
                        {task.description && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {task.description}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge
                            variant="outline"
                            className="text-xs glass capitalize"
                          >
                            {task.status.replace("_", " ")}
                          </Badge>
                          {agent && (
                            <div className="flex items-center gap-1">
                              <AgentAvatar
                                name={agent.agent.name}
                                icon={agent.agent.icon}
                                color={agent.agent.color}
                                size="sm"
                              />
                              <span className="text-xs text-muted-foreground">
                                {agent.agent.name}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* DELIVERABLES */}
        <TabsContent value="deliverables">
          <Card className="glass border-purple-500/10 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Deliverables Vault</h3>
              {project.agents.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    handleRequestDeliverable(project.agents[0].agent.name)
                  }
                  disabled={requestingDeliverable}
                  className="glass"
                >
                  {requestingDeliverable ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <PlusCircle className="mr-1 h-3 w-3" />
                  )}
                  {t("project.requestDeliverable")}
                </Button>
              )}
            </div>

            {project.deliverables.length === 0 ? (
              <div className="text-center py-12">
                <FileBox className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {t("project.noDeliverables")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click &quot;Request Deliverable&quot; to have an agent generate one.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {project.deliverables.map((d) => {
                  const FileIcon = FILE_ICONS[d.fileType] || FileText;
                  return (
                    <div
                      key={d.id}
                      className="glass rounded-lg p-3 flex items-start gap-3"
                    >
                      <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20">
                        <FileIcon className="h-5 w-5 text-purple-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {d.title}
                        </div>
                        {d.description && (
                          <div className="text-xs text-muted-foreground truncate">
                            {d.description}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <Badge
                            variant="outline"
                            className="text-xs glass capitalize"
                          >
                            {d.fileType}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            by {d.uploader.name} ·{" "}
                            {new Date(d.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDownload(d)}
                        className="flex-shrink-0"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ACTIVITY */}
        <TabsContent value="activity">
          <Card className="glass border-purple-500/10 p-4">
            {project.activities.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  No recent activity.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {project.activities.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-start gap-3 glass rounded-lg p-3"
                  >
                    <div className="flex-shrink-0 h-2 w-2 rounded-full bg-purple-500 mt-1.5 pulse-dot" />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{a.action}</div>
                      {a.details && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {a.details}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(a.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
