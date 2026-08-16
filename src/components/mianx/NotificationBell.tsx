"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Check,
  CheckCheck,
  AlertTriangle,
  Info,
  AlertCircle,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  priority?: string;
  isRead: boolean;
  createdAt: string;
}

// ─────────────────────────────────────────────
//  Priority icon mapping
// ─────────────────────────────────────────────

function getNotifIcon(type: string) {
  switch (type) {
    case "mission_completed":
    case "task_completed":
      return <CheckCheck className="h-4 w-4 text-emerald-400" />;
    case "mission_failed":
    case "task_failed":
    case "error":
      return <AlertCircle className="h-4 w-4 text-red-400" />;
    case "approval_required":
    case "human_approval_requested":
      return <AlertTriangle className="h-4 w-4 text-amber-400" />;
    case "budget_warning":
    case "budget_exceeded":
      return <AlertTriangle className="h-4 w-4 text-red-400" />;
    default:
      return <Info className="h-4 w-4 text-blue-400" />;
  }
}

function getPriorityColor(priority?: string) {
  switch (priority) {
    case "high":
    case "critical":
      return "border-red-500/30 bg-red-500/5";
    case "medium":
      return "border-amber-500/30 bg-amber-500/5";
    default:
      return "border-transparent";
  }
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

// ─────────────────────────────────────────────
//  NotificationBell Component
// ─────────────────────────────────────────────

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?unreadOnly=false");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // Silently fail
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // SSE stream for real-time notifications
  useEffect(() => {
    try {
      const es = new EventSource("/api/notifications/stream");
      eventSourceRef.current = es;

      es.addEventListener("notification", (event) => {
        try {
          const notif = JSON.parse(event.data);
          // Add to list and increment unread
          setNotifications((prev) => [notif, ...prev].slice(0, 50));
          setUnreadCount((prev) => prev + 1);
        } catch { /* skip */ }
      });

      es.onerror = () => {
        es.close();
      };
    } catch {
      // SSE not available
    }

    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Mark single as read
  const markAsRead = async (id: string) => {
    try {
      await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isRead: true }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch { /* skip */ }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    setMarkingAll(true);
    try {
      await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch { /* skip */ }
    setMarkingAll(false);
  };

  // Refresh
  const handleRefresh = () => {
    setLoading(true);
    fetchNotifications().finally(() => setLoading(false));
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(!isOpen)}
            className="relative h-9 w-9 p-0 hover:bg-accent"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 px-1 text-[10px] font-bold text-white"
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </motion.span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Notifications</TooltipContent>
      </Tooltip>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 sm:w-96 z-50 rounded-xl border border-purple-500/20 glass-strong shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-purple-500/10">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-semibold">Notifications</span>
                {unreadCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] bg-purple-500/20 text-purple-300"
                  >
                    {unreadCount} new
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={markAllAsRead}
                    disabled={markingAll}
                    className="h-7 text-[10px] text-muted-foreground hover:text-foreground gap-1"
                  >
                    <Check className="h-3 w-3" />
                    {markingAll ? "..." : "All read"}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={loading}
                  className="h-7 text-[10px] text-muted-foreground hover:text-foreground"
                >
                  <Sparkles className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>

            {/* Notification List */}
            <ScrollArea className="max-h-80">
              {loading && notifications.length === 0 ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-3">
                      <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3 w-3/4" />
                        <Skeleton className="h-2.5 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <Bell className="h-8 w-8 text-muted-foreground/20 mb-2" />
                  <p className="text-sm text-muted-foreground">No notifications yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    We&apos;ll notify you about mission updates
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-purple-500/5">
                  {notifications.map((notif) => (
                    <button
                      key={notif.id}
                      onClick={() => !notif.isRead && markAsRead(notif.id)}
                      className={`flex items-start gap-3 w-full px-4 py-3 text-left transition-colors hover:bg-purple-500/5 ${getPriorityColor(notif.priority)} ${!notif.isRead ? "bg-purple-500/3" : ""}`}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {getNotifIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs ${!notif.isRead ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                          {notif.title}
                        </p>
                        {notif.message && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                            {notif.message}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground/50 mt-1">
                          {timeAgo(notif.createdAt)}
                        </p>
                      </div>
                      {!notif.isRead && (
                        <div className="flex-shrink-0 w-2 h-2 rounded-full bg-purple-400 mt-1.5" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
