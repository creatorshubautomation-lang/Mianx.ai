"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Ticket,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
} from "lucide-react";

interface Ticket {
  id: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  category: string;
  response: string | null;
  createdAt: string;
  respondedAt: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  open: { label: "Open", color: "bg-blue-500/20 text-blue-300", icon: Clock },
  in_progress: { label: "In Progress", color: "bg-amber-500/20 text-amber-300", icon: AlertCircle },
  resolved: { label: "Resolved", color: "bg-green-500/20 text-green-300", icon: CheckCircle2 },
  closed: { label: "Closed", color: "bg-gray-500/20 text-gray-300", icon: CheckCircle2 },
};

const PRIORITY_CONFIG: Record<string, string> = {
  low: "bg-gray-500/20 text-gray-300",
  normal: "bg-blue-500/20 text-blue-300",
  high: "bg-amber-500/20 text-amber-300",
  urgent: "bg-red-500/20 text-red-300",
};

export function SupportView() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("normal");
  const [category, setCategory] = useState("general");

  const loadTickets = () => {
    fetch("/api/tickets")
      .then((r) => r.json())
      .then((data) => {
        if (data.tickets) setTickets(data.tickets);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          description,
          priority,
          category,
        }),
      });
      const data = await res.json();

      if (data.ok) {
        toast.success("Ticket created! We'll respond soon.");
        setShowCreate(false);
        setSubject("");
        setDescription("");
        setPriority("normal");
        setCategory("general");
        loadTickets();
      } else {
        toast.error(data.error || "Failed to create ticket");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Support</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Get help from our team. We typically respond within 24 hours.
          </p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="btn-gradient text-white">
              <Plus className="mr-2 h-4 w-4" />
              New Ticket
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md glass-strong border-purple-500/20">
            <DialogHeader>
              <DialogTitle>Create Support Ticket</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  placeholder="Brief description of your issue"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                  className="glass"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe your issue in detail..."
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  className="glass resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger className="glass">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="glass">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="billing">Billing</SelectItem>
                      <SelectItem value="technical">Technical</SelectItem>
                      <SelectItem value="bug">Bug Report</SelectItem>
                      <SelectItem value="feature">Feature Request</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full btn-gradient text-white"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Ticket"
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Open", value: tickets.filter((t) => t.status === "open").length, color: "text-blue-400" },
          { label: "In Progress", value: tickets.filter((t) => t.status === "in_progress").length, color: "text-amber-400" },
          { label: "Resolved", value: tickets.filter((t) => t.status === "resolved").length, color: "text-green-400" },
          { label: "Total", value: tickets.length, color: "text-purple-400" },
        ].map((stat) => (
          <Card key={stat.label} className="glass border-purple-500/10 p-4 text-center">
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-muted-foreground">{stat.label}</div>
          </Card>
        ))}
      </div>

      {/* Tickets list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
        </div>
      ) : tickets.length === 0 ? (
        <Card className="glass border-purple-500/10 p-12 text-center">
          <Ticket className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
          <h3 className="font-semibold text-lg mb-2">No tickets yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Need help with something? Create your first support ticket.
          </p>
          <Button
            onClick={() => setShowCreate(true)}
            className="btn-gradient text-white"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Ticket
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => {
            const status = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
            const StatusIcon = status.icon;

            return (
              <Card
                key={ticket.id}
                className="glass border-purple-500/10 p-5 card-hover"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold truncate">{ticket.subject}</h3>
                      <Badge className={`text-xs ${status.color}`}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {status.label}
                      </Badge>
                      <Badge className={`text-xs ${PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.normal}`}>
                        {ticket.priority}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {ticket.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Ticket className="h-3 w-3" />
                    {ticket.category}
                  </span>
                  <span>•</span>
                  <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                </div>

                {ticket.response && (
                  <div className="mt-3 p-3 glass rounded-md border-l-2 border-purple-500">
                    <div className="flex items-center gap-2 mb-1">
                      <MessageSquare className="h-3 w-3 text-purple-400" />
                      <span className="text-xs font-semibold text-purple-300">
                        Support Response
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{ticket.response}</p>
                    {ticket.respondedAt && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Responded: {new Date(ticket.respondedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
