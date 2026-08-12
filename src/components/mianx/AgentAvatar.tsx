"use client";

import * as LucideIcons from "lucide-react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentAvatarProps {
  name: string;
  icon: string;
  color: string;
  size?: "sm" | "md" | "lg" | "xl";
  status?: "working" | "assigned" | "waiting" | "done" | "paused";
  className?: string;
}

const sizeMap = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-14 w-14",
  xl: "h-20 w-20",
};

const iconSizeMap = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-7 w-7",
  xl: "h-10 w-10",
};

const statusColors: Record<string, string> = {
  working: "bg-green-500",
  assigned: "bg-purple-500",
  waiting: "bg-amber-500",
  done: "bg-blue-500",
  paused: "bg-gray-500",
};

export function AgentAvatar({
  name,
  icon,
  color,
  size = "md",
  status,
  className,
}: AgentAvatarProps) {
  // Dynamically get the icon from lucide
  const IconComponent = (
    LucideIcons as unknown as Record<string, LucideIcon>
  )[icon] || LucideIcons.Sparkles;

  return (
    <div className={cn("relative inline-block", className)}>
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-gradient-to-br text-white font-semibold",
          color,
          sizeMap[size],
        )}
      >
        <IconComponent className={iconSizeMap[size]} />
      </div>
      {status && (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background pulse-dot",
            statusColors[status],
          )}
        />
      )}
    </div>
  );
}
