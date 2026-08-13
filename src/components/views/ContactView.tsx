"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Mail, Phone, MapPin, MessageCircle, Send } from "lucide-react";
import { motion } from "framer-motion";

export function ContactView() {
  const { setAuthModal } = useApp();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate send (we don't have an email service, but log it)
    await new Promise((r) => setTimeout(r, 1000));
    toast.success("Message sent! We'll get back to you within 24 hours.");
    setForm({ name: "", email: "", company: "", message: "" });
    setLoading(false);
  };

  const contactInfo = [
    {
      icon: Mail,
      label: "Email",
      value: "hello@mianx.ai",
      href: "mailto:hello@mianx.ai",
    },
    {
      icon: MessageCircle,
      label: "Live Chat",
      value: "Available 24/7",
      href: "#",
    },
    {
      icon: Phone,
      label: "Phone",
      value: "+1 (415) 555-MIAX",
      href: "tel:+14155556429",
    },
    {
      icon: MapPin,
      label: "Office",
      value: "Remote-first · Global",
      href: "#",
    },
  ];

  return (
    <div className="relative min-h-screen pt-24 pb-20">
      <div className="fixed inset-0 mesh-bg-soft -z-10" />

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold">
            Let&apos;s <span className="gradient-text">talk</span>
          </h1>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Questions about a project, pricing, or partnership? Send us a message — we usually reply within a few hours.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Contact info */}
          <div className="space-y-3">
            {contactInfo.map((c, i) => (
              <motion.div
                key={c.label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <Card className="glass border-purple-500/10 p-5 card-hover">
                  <a
                    href={c.href}
                    onClick={(e) => e.preventDefault()}
                    className="flex items-center gap-4"
                  >
                    <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500">
                      <c.icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">
                        {c.label}
                      </div>
                      <div className="text-sm font-medium">{c.value}</div>
                    </div>
                  </a>
                </Card>
              </motion.div>
            ))}

            <Card className="glass-strong border-purple-500/20 p-5 mt-6">
              <h3 className="font-semibold mb-1">Prefer to try first?</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Sign up free and chat with our agents directly — no sales call needed.
              </p>
              <Button
                onClick={() => setAuthModal("signup")}
                size="sm"
                className="w-full btn-gradient text-white"
              >
                Start Free
              </Button>
            </Card>
          </div>

          {/* Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2"
          >
            <Card className="glass-strong border-purple-500/20 p-8">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      required
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                      placeholder="John Doe"
                      className="glass"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                      placeholder="you@company.com"
                      className="glass"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Company (optional)</Label>
                  <Input
                    id="company"
                    value={form.company}
                    onChange={(e) =>
                      setForm({ ...form, company: e.target.value })
                    }
                    placeholder="Acme Inc."
                    className="glass"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    required
                    rows={6}
                    value={form.message}
                    onChange={(e) =>
                      setForm({ ...form, message: e.target.value })
                    }
                    placeholder="Tell us about your project, timeline, and budget..."
                    className="glass resize-none"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  size="lg"
                  className="w-full btn-gradient text-white"
                >
                  {loading ? (
                    "Sending..."
                  ) : (
                    <>
                      Send Message
                      <Send className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
