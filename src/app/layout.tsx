import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { ErrorBoundary } from "@/components/mianx/ErrorBoundary";

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

function getMetadataBase(): URL {
  try {
    const url =
      process.env.NEXTAUTH_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    return new URL(url);
  } catch {
    return new URL("http://localhost:3000");
  }
}

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
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
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    title: "Mianx.ai — Agentic Software House",
    description:
      "The first software house run by AI agents. Design, dev, content, marketing, QA, support — all autonomous.",
    url: "https://mianx.ai",
    siteName: "Mianx.ai",
    type: "website",
    images: [
      { url: "/og-image.png", width: 1200, height: 630, alt: "Mianx.ai — Agentic Software House" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Mianx.ai — Agentic Software House",
    description:
      "The first software house run by AI agents. Design, dev, content, marketing, QA, support — all autonomous.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <head>
        <noscript>
          <style dangerouslySetInnerHTML={{ __html: ".no-js-msg{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#0a0a1a;color:#e2e8f0;font-family:system-ui,sans-serif;font-size:1.25rem;text-align:center;padding:2rem;z-index:9999}.no-js-msg h1{font-size:2rem;margin-bottom:1rem;color:#a855f7}" }} />
          <div className="no-js-msg">
            <div>
              <h1>Mianx.ai</h1>
              <p>JavaScript is required to run this application.</p>
              <p style={{ marginTop: "1rem", fontSize: "0.875rem", color: "#94a3b8" }}>Please enable JavaScript in your browser settings and reload.</p>
            </div>
          </div>
        </noscript>
      </head>
      <body
        className={`${inter.variable} ${jetBrainsMono.variable} antialiased bg-background text-foreground min-h-screen`}
        suppressHydrationWarning
      >
        <ErrorBoundary>
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
        </ErrorBoundary>
      </body>
    </html>
  );
}
