"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Bell, Clock } from "lucide-react";
import { toast } from "sonner";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  isRead: boolean;
  actionUrl: string | null;
  createdAt: string;
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Ref to hold the EventSource so we can close it on unmount / reconnect.
  const eventSourceRef = useRef<EventSource | null>(null);
  // Ref for reconnect timer
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Exponential backoff delay (starts at 1 s, caps at 30 s)
  const reconnectDelayRef = useRef(1000);
  // Keep a ref to current notification ids so the SSE handler can avoid
  // duplicates without depending on stale state closures.
  const notifIdsRef = useRef<Set<string>>(new Set());

  // ── Fetch existing notifications (initial load) ──────────────────
  const loadNotifications = useCallback(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((data) => {
        if (data.notifications) {
          setNotifications(data.notifications);
          setUnreadCount(data.unreadCount || 0);
          // Sync the id set so SSE can deduplicate.
          notifIdsRef.current = new Set(data.notifications.map((n: Notification) => n.id));
        }
      })
      .catch(() => {});
  }, []);

  // Ref that holds the connect function so the error handler can
  // call it for reconnection without triggering the "accessed before
  // declaration" lint rule.
  const connectSSERef = useRef<() => void>(() => {});

  // ── Connect to the SSE stream ────────────────────────────────────
  const connectSSE = useCallback(() => {
    // Close any existing connection first.
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource("/api/notifications/stream");
    eventSourceRef.current = es;

    // ── Handle incoming notification events ────────────────────────
    es.addEventListener("notification", (e) => {
      try {
        const parsed: Notification | Notification[] = JSON.parse(e.data);
        const currentIds = notifIdsRef.current;

        if (Array.isArray(parsed)) {
          // Initial batch from server — merge avoiding duplicates.
          const fresh = parsed.filter((n) => !currentIds.has(n.id));
          if (fresh.length === 0) return;

          // Update the id set.
          fresh.forEach((n) => currentIds.add(n.id));
          notifIdsRef.current = currentIds;

          setNotifications((prev) => [...fresh, ...prev]);
          setUnreadCount((prev) => prev + fresh.length);
        } else {
          // Single new notification — prepend if not already known.
          if (currentIds.has(parsed.id)) return;
          currentIds.add(parsed.id);
          notifIdsRef.current = currentIds;

          setNotifications((prev) => [parsed, ...prev]);
          setUnreadCount((prev) => prev + 1);
        }
      } catch {
        // ignore malformed data
      }
    });

    // ── Heartbeat — confirms connection is alive ───────────────────
    es.addEventListener("heartbeat", () => {
      // Connection is healthy — reset backoff delay.
      reconnectDelayRef.current = 1000;
    });

    // ── Error handling — reconnect with exponential backoff ────────
    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;

      const delay = reconnectDelayRef.current;
      reconnectDelayRef.current = Math.min(delay * 2, 30_000);

      reconnectTimerRef.current = setTimeout(() => {
        connectSSERef.current();
      }, delay);
    };
  }, []);

  // Keep the ref in sync so the error handler always calls the latest.
  connectSSERef.current = connectSSE;

  // ── Lifecycle: mount / unmount ────────────────────────────────────
  useEffect(() => {
    // Fetch existing notifications on mount.
    loadNotifications();
    // Open the SSE stream for real-time updates.
    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [loadNotifications, connectSSE]);

  const handleMarkAllRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      setUnreadCount(0);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true })),
      );
    } catch {
      toast.error("Failed to mark notifications");
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // silent
    }
  };

  const formatTime = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const priorityColors: Record<string, string> = {
    high: "bg-red-500/20 text-red-300",
    urgent: "bg-red-500/20 text-red-300",
    normal: "bg-purple-500/20 text-purple-300",
    low: "bg-gray-500/20 text-gray-300",
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white pulse-dot">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 sm:w-96 p-0 glass-strong border-purple-500/20"
      >
        <div className="flex items-center justify-between p-3 border-b border-purple-500/10">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Bell className="h-4 w-4 text-purple-400" />
            Notifications
            {unreadCount > 0 && (
              <Badge className="bg-red-500/20 text-red-300 text-xs">
                {unreadCount} new
              </Badge>
            )}
          </h3>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-purple-300 hover:text-purple-200"
            >
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-6 text-center">
              <Bell className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                No notifications yet
              </p>
            </div>
          ) : (
            notifications.slice(0, 10).map((notif) => (
              <div
                key={notif.id}
                className={`p-3 border-b border-purple-500/5 hover:bg-purple-500/5 cursor-pointer ${
                  !notif.isRead ? "bg-purple-500/5" : ""
                }`}
                onClick={() => handleMarkRead(notif.id)}
              >
                <div className="flex items-start gap-2">
                  {!notif.isRead && (
                    <span className="mt-1.5 h-2 w-2 rounded-full bg-purple-400 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{notif.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {notif.message}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        {formatTime(notif.createdAt)}
                      </span>
                      {notif.priority !== "normal" && (
                        <Badge
                          className={`text-xs ${priorityColors[notif.priority] || priorityColors.normal}`}
                        >
                          {notif.priority}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {notifications.length > 0 && (
          <div className="p-2 border-t border-purple-500/10 text-center">
            <button className="text-xs text-purple-300 hover:text-purple-200">
              View all
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
