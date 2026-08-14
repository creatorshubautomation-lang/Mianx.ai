// Mianx.ai — ZIP File Generation Service
// Creates proper downloadable ZIP files with multiple project files
// (code, README, configs, etc.)

import JSZip from "jszip";

interface ProjectFile {
  path: string; // e.g., "src/app/page.tsx"
  content: string;
}

interface ZipOptions {
  projectName: string;
  projectType: string;
  files: ProjectFile[];
  deliverableTitle: string;
  agentName: string;
  agentRole: string;
  description?: string;
}

// ─────────────────────────────────────────────
//  Generate ZIP file from AI deliverable content
//  Parses the content to extract code blocks + creates structured files
// ─────────────────────────────────────────────

export async function generateProjectZip(
  opts: ZipOptions,
): Promise<{ buffer: Buffer; fileName: string; fileCount: number }> {
  const zip = new JSZip();

  // Root folder name (sanitized)
  const rootFolder = sanitizeFileName(opts.projectName).toLowerCase().replace(/\s+/g, "-");
  const projectFolder = zip.folder(rootFolder);
  if (!projectFolder) {
    throw new Error("Failed to create project folder in ZIP");
  }

  let fileCount = 0;

  // 1. Add AI-generated files
  for (const file of opts.files) {
    projectFolder.file(file.path, file.content);
    fileCount++;
  }

  // 2. Generate README.md
  const readme = generateReadme(opts);
  projectFolder.file("README.md", readme);
  fileCount++;

  // 3. Generate package.json if not present
  const hasPackageJson = opts.files.some((f) => f.path === "package.json");
  if (!hasPackageJson && shouldHavePackageJson(opts.projectType)) {
    projectFolder.file("package.json", generatePackageJson(opts));
    fileCount++;
  }

  // 4. Generate .env.example
  projectFolder.file(".env.example", generateEnvExample(opts));
  fileCount++;

  // 5. Generate .gitignore
  projectFolder.file(".gitignore", generateGitignore());
  fileCount++;

  // 6. Generate project info file
  const info = {
    projectName: opts.projectName,
    projectType: opts.projectType,
    generatedBy: "Mianx.ai",
    agent: {
      name: opts.agentName,
      role: opts.agentRole,
    },
    deliverableTitle: opts.deliverableTitle,
    description: opts.description,
    generatedAt: new Date().toISOString(),
    fileCount: fileCount + 1, // +1 for this file
  };
  projectFolder.file(".mianx-info.json", JSON.stringify(info, null, 2));
  fileCount++;

  // Generate ZIP buffer
  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const fileName = `${rootFolder}-${Date.now()}.zip`;

  return { buffer, fileName, fileCount };
}

// ─────────────────────────────────────────────
//  Parse AI-generated content to extract code blocks
//  Returns array of files with paths + content
// ─────────────────────────────────────────────

export function parseAiContentToFiles(
  content: string,
  defaultFileName = "deliverable.txt",
): ProjectFile[] {
  const files: ProjectFile[] = [];

  // Look for code blocks with language + optional filename
  // Pattern: ```language:path/to/file or ```language\n// path: file
  const codeBlockRegex = /```(\w+)?(?::([^\n]+))?\n([\s\S]*?)```/g;
  let match;
  let blockIndex = 0;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const language = match[1] || "txt";
    const filePath = match[2]?.trim() || generateDefaultPath(language, blockIndex);
    const code = match[3].trim();

    files.push({
      path: filePath,
      content: code,
    });
    blockIndex++;
  }

  // If no code blocks found, treat whole content as single file
  if (files.length === 0) {
    files.push({
      path: defaultFileName,
      content: content.trim(),
    });
  }

  return files;
}

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || "project";
}

function shouldHavePackageJson(projectType: string): boolean {
  return ["web", "mobile", "fullstack", "full_stack"].includes(projectType);
}

function generateDefaultPath(language: string, index: number): string {
  const ext = languageToExtension(language);
  if (language === "tsx" || language === "jsx") {
    return `src/components/Component${index + 1}.${ext}`;
  }
  if (language === "ts" || language === "js") {
    return `src/file${index + 1}.${ext}`;
  }
  return `file${index + 1}.${ext}`;
}

function languageToExtension(lang: string): string {
  const map: Record<string, string> = {
    javascript: "js",
    js: "js",
    typescript: "ts",
    ts: "ts",
    jsx: "jsx",
    tsx: "tsx",
    python: "py",
    py: "py",
    css: "css",
    scss: "scss",
    html: "html",
    json: "json",
    bash: "sh",
    sh: "sh",
    yaml: "yml",
    yml: "yml",
    markdown: "md",
    md: "md",
    sql: "sql",
    prisma: "prisma",
    dockerfile: "Dockerfile",
  };
  return map[lang.toLowerCase()] || "txt";
}

function generateReadme(opts: ZipOptions): string {
  return `# ${opts.projectName}

> Generated by **Mianx.ai** — The Agentic Software House

## 📋 Project Info

- **Type**: ${opts.projectType}
- **Generated by**: ${opts.agentName} (${opts.agentRole})
- **Deliverable**: ${opts.deliverableTitle}
- **Generated at**: ${new Date().toISOString()}

${opts.description ? `## 📝 Description\n\n${opts.description}\n` : ""}

## 📁 Files

This ZIP contains AI-generated code + configuration files. Review each file before using in production.

## 🚀 Getting Started

1. Extract this ZIP file
2. Install dependencies (if applicable):
   \`\`\`bash
   npm install
   # or
   bun install
   \`\`\`
3. Copy \`.env.example\` to \`.env\` and fill in your values
4. Run the project (see file-specific instructions)

## ⚠️ Important Notes

- This code was generated by AI agents
- Review + test thoroughly before production use
- Security audits recommended (contact Cipher agent)
- Performance optimization may be needed (contact Radar agent)

## 🤖 About Mianx.ai

Mianx.ai is the world's first agentic software house. Every project is delivered by a dedicated team of 24 AI agents — design, development, content, marketing, QA, and support.

Visit: https://mianx.ai

---

© 2026 Mianx.ai — Generated by ${opts.agentName}
`;
}

function generatePackageJson(opts: ZipOptions): string {
  const pkgName = sanitizeFileName(opts.projectName)
    .toLowerCase()
    .replace(/\s+/g, "-");

  return JSON.stringify(
    {
      name: pkgName,
      version: "0.1.0",
      private: true,
      description: opts.description || `Generated by Mianx.ai — ${opts.projectName}`,
      scripts: {
        dev: "next dev",
        build: "next build",
        start: "next start",
        lint: "eslint .",
      },
      dependencies: {},
      devDependencies: {},
      generatedBy: "Mianx.ai",
      generatedAt: new Date().toISOString(),
    },
    null,
    2,
  );
}

function generateEnvExample(opts: ZipOptions): string {
  return `# ${opts.projectName} — Environment Variables
# Copy this file to .env and fill in your values

# Database
DATABASE_URL=

# Authentication
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000

# AI Providers (optional — for AI features)
# ZAI_API_KEY=
# GEMINI_API_KEY=
# OPENAI_API_KEY=

# Generated by Mianx.ai — ${opts.agentName}
`;
}

function generateGitignore(): string {
  return `# Dependencies
node_modules/
.pnp
.yarn/*

# Build output
.next/
out/
dist/
build/

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
yarn-debug.log*

# Generated by Mianx.ai
.mianx-info.json
`;
}
