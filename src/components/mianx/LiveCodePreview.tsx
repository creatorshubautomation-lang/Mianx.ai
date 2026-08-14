"use client";

import { useState, useMemo } from "react";
import {
  SandpackProvider,
  SandpackPreview,
  SandpackCodeEditor,
  SandpackLayout,
  Sandpack,
} from "@codesandbox/sandpack-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Code2,
  Eye,
  RefreshCw,
  Download,
  Copy,
  Check,
  Maximize2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface LiveCodePreviewProps {
  code: string;
  fileName?: string;
  language?: string;
  title?: string;
}

// ─────────────────────────────────────────────
//  Detect language + convert to Sandpack format
// ─────────────────────────────────────────────

function detectLanguage(code: string, language?: string): "react" | "html" | "vue" | "static" {
  if (language === "html") return "html";
  if (language === "vue") return "vue";
  if (
    code.includes("import React") ||
    code.includes("from 'react'") ||
    code.includes('from "react"') ||
    code.includes("export default function") ||
    code.includes("return (")
  ) {
    return "react";
  }
  return "static";
}

// ─────────────────────────────────────────────
//  Extract code blocks from AI response
// ─────────────────────────────────────────────

interface CodeBlock {
  language: string;
  code: string;
  fileName: string;
}

function extractCodeBlocks(content: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const regex = /```(\w+)?(?::([^\n]+))?\n([\s\S]*?)```/g;
  let match;
  let index = 0;

  while ((match = regex.exec(content)) !== null) {
    const language = match[1] || "javascript";
    const fileName = match[2]?.trim() || `file${index + 1}.${langToExt(language)}`;
    const code = match[3].trim();

    blocks.push({ language, code, fileName });
    index++;
  }

  // If no code blocks, treat whole content as one
  if (blocks.length === 0) {
    blocks.push({
      language: "javascript",
      code: content.trim(),
      fileName: "code.js",
    });
  }

  return blocks;
}

function langToExt(lang: string): string {
  const map: Record<string, string> = {
    javascript: "js",
    js: "js",
    typescript: "ts",
    ts: "ts",
    jsx: "jsx",
    tsx: "tsx",
    python: "py",
    py: "py",
    html: "html",
    css: "css",
    json: "json",
  };
  return map[lang.toLowerCase()] || "txt";
}

// ─────────────────────────────────────────────
//  Main component
// ─────────────────────────────────────────────

export function LiveCodePreview({
  code,
  fileName = "App.js",
  language,
  title = "Live Preview",
}: LiveCodePreviewProps) {
  const [activeView, setActiveView] = useState<"code" | "preview">("preview");
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const blocks = useMemo(() => extractCodeBlocks(code), [code]);
  const detectedLang = useMemo(
    () => detectLanguage(code, language),
    [code, language],
  );

  // Build Sandpack files
  const sandpackFiles = useMemo(() => {
    const files: Record<string, { code: string; active?: boolean; hidden?: boolean }> = {};

    // If React code, wrap in App component
    if (detectedLang === "react") {
      // Check if code is already a complete component
      const isComponent =
        code.includes("export default") || code.includes("function App");

      if (isComponent) {
        files["/App.js"] = { code, active: true };
      } else {
        // Wrap in component
        files["/App.js"] = {
          code: `export default function App() {
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
${code
  .split("\n")
  .map((line) => `      ${line}`)
  .join("\n")}
    </div>
  );
}`,
          active: true,
        };
      }

      // Add default dependencies
      files["/index.js"] = {
        code: `import React, { createRoot } from "react";
import App from "./App";
const root = createRoot(document.getElementById("root"));
root.render(<App />);`,
        hidden: true,
      };
    } else if (detectedLang === "html") {
      files["/index.html"] = { code, active: true };
    } else {
      // Static — show as text
      files["/App.js"] = {
        code: `export default function App() {
  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
      ${code.replace(/`/g, "\\`").replace(/\$/g, "\\$")}
    </div>
  );
}`,
        active: true,
      };
      files["/index.js"] = {
        code: `import React, { createRoot } from "react";
import App from "./App";
const root = createRoot(document.getElementById("root"));
root.render(<App />);`,
        hidden: true,
      };
    }

    return files;
  }, [code, detectedLang]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Code copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded!");
  };

  // Determine Sandpack template
  const sandpackTemplate =
    detectedLang === "html" ? "static" : "react";

  return (
    <div
      className={`glass-strong border-purple-500/20 rounded-lg overflow-hidden ${
        fullscreen ? "fixed inset-4 z-50" : ""
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-purple-500/10">
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-purple-400" />
          <span className="text-sm font-medium">{title}</span>
          <Badge variant="outline" className="text-xs glass">
            {detectedLang}
          </Badge>
          {blocks.length > 1 && (
            <Badge variant="outline" className="text-xs glass">
              {blocks.length} files
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* View toggle */}
          <div className="flex gap-1 mr-2">
            <Button
              size="sm"
              variant={activeView === "code" ? "default" : "ghost"}
              onClick={() => setActiveView("code")}
              className="h-7 text-xs"
            >
              <Code2 className="h-3 w-3 mr-1" />
              Code
            </Button>
            <Button
              size="sm"
              variant={activeView === "preview" ? "default" : "ghost"}
              onClick={() => setActiveView("preview")}
              className="h-7 text-xs"
            >
              <Eye className="h-3 w-3 mr-1" />
              Preview
            </Button>
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopy}
            className="h-7 w-7 p-0"
            title="Copy code"
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-400" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleDownload}
            className="h-7 w-7 p-0"
            title="Download"
          >
            <Download className="h-3 w-3" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setFullscreen(!fullscreen)}
            className="h-7 w-7 p-0"
            title="Fullscreen"
          >
            <Maximize2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div
        className={`${
          fullscreen ? "h-[calc(100%-3rem)]" : "h-[400px]"
        } overflow-hidden`}
      >
        {activeView === "code" ? (
          <div className="h-full overflow-auto p-4">
            <pre className="text-xs font-mono text-foreground whitespace-pre-wrap">
              {code}
            </pre>
          </div>
        ) : (
          <SandpackProvider
            template={sandpackTemplate}
            files={sandpackFiles}
            theme="dark"
            options={{
              showNavigator: false,
              showTabs: false,
              showLineNumbers: false,
              showInlineErrors: true,
              closableTabs: false,
            }}
          >
            <SandpackLayout
              style={{
                height: "100%",
                border: "none",
                borderRadius: 0,
              }}
            >
              <SandpackPreview
                style={{
                  height: "100%",
                  width: "100%",
                }}
                showOpenInCodeSandbox={false}
                showRefreshButton={true}
              />
            </SandpackLayout>
          </SandpackProvider>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Simple code viewer (no Sandpack — for non-React code)
// ─────────────────────────────────────────────

export function SimpleCodeViewer({
  code,
  language = "javascript",
  fileName = "code.txt",
}: {
  code: string;
  language?: string;
  fileName?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass-strong border-purple-500/20 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-purple-500/10">
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-purple-400" />
          <span className="text-sm font-mono">{fileName}</span>
          <Badge variant="outline" className="text-xs glass">
            {language}
          </Badge>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCopy}
          className="h-7 text-xs"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 mr-1 text-green-400" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3 mr-1" />
              Copy
            </>
          )}
        </Button>
      </div>
      <div className="p-4 overflow-auto max-h-96">
        <pre className="text-xs font-mono text-foreground whitespace-pre-wrap">
          {code}
        </pre>
      </div>
    </div>
  );
}
