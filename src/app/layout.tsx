import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXTAUTH_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"),
  ),
  title: "Mianx.ai — Agentic Software House | AI Agents Build Your Projects",
  description:
    "Mianx.ai is the world's first agentic software house. Every client project is delivered by a dedicated team of AI agents — design, development, content, marketing, QA, and support. 100% autonomous, 24/7.",
  keywords: [
    "Mianx.ai",
    "AI software house",
    "agentic AI",
    "AI agents",
    "AI development",
    "autonomous software development",
    "AI design agents",
    "AI content agents",
  ],
  authors: [{ name: "Mianx.ai" }],
  openGraph: {
    title: "Mianx.ai — Agentic Software House",
    description:
      "The first software house run by AI agents. Design, dev, content, marketing, QA, support — all autonomous.",
    url: "https://mianx.ai",
    siteName: "Mianx.ai",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mianx.ai — Agentic Software House",
    description:
      "The first software house run by AI agents. Design, dev, content, marketing, QA, support — all autonomous.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={`${inter.variable} ${jetBrainsMono.variable} antialiased bg-background text-foreground min-h-screen`}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          <SonnerToaster position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
