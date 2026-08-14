// Mianx.ai — Multi-language Code Generation Support
// Extends agents to generate code in multiple programming languages

export type LanguageId =
  | "typescript"
  | "javascript"
  | "python"
  | "go"
  | "rust"
  | "java"
  | "csharp"
  | "php"
  | "ruby"
  | "swift"
  | "kotlin"
  | "dart";

export interface LanguageConfig {
  id: LanguageId;
  name: string;
  icon: string;
  color: string;
  extension: string;
  // Framework suggestions for common project types
  frameworks: {
    web?: string;
    api?: string;
    mobile?: string;
    desktop?: string;
  };
  // File naming convention
  fileNaming: "pascal" | "camel" | "snake" | "kebab";
  // Comment syntax
  commentSyntax: "//" | "#" | "--";
  // Common packages/imports
  helloWorld: string;
}

export const LANGUAGES: LanguageConfig[] = [
  {
    id: "typescript",
    name: "TypeScript",
    icon: "Code2",
    color: "from-blue-500 to-cyan-500",
    extension: "ts",
    frameworks: {
      web: "Next.js",
      api: "Express",
      mobile: "React Native",
      desktop: "Electron",
    },
    fileNaming: "camel",
    commentSyntax: "//",
    helloWorld: `console.log("Hello, World!");`,
  },
  {
    id: "javascript",
    name: "JavaScript",
    icon: "Code2",
    color: "from-yellow-500 to-amber-500",
    extension: "js",
    frameworks: {
      web: "Next.js",
      api: "Express",
      mobile: "React Native",
      desktop: "Electron",
    },
    fileNaming: "camel",
    commentSyntax: "//",
    helloWorld: `console.log("Hello, World!");`,
  },
  {
    id: "python",
    name: "Python",
    icon: "FileCode",
    color: "from-green-500 to-blue-500",
    extension: "py",
    frameworks: {
      web: "Django",
      api: "FastAPI",
      mobile: "Kivy",
      desktop: "Tkinter",
    },
    fileNaming: "snake",
    commentSyntax: "#",
    helloWorld: `print("Hello, World!")`,
  },
  {
    id: "go",
    name: "Go",
    icon: "Server",
    color: "from-cyan-500 to-blue-500",
    extension: "go",
    frameworks: {
      web: "Gin",
      api: "net/http",
      mobile: "Gomobile",
      desktop: "Wails",
    },
    fileNaming: "camel",
    commentSyntax: "//",
    helloWorld: `package main

import "fmt"

func main() {
    fmt.Println("Hello, World!")
}`,
  },
  {
    id: "rust",
    name: "Rust",
    icon: "Shield",
    color: "from-orange-500 to-red-500",
    extension: "rs",
    frameworks: {
      web: "Actix",
      api: "Rocket",
      mobile: "Tauri",
      desktop: "Tauri",
    },
    fileNaming: "snake",
    commentSyntax: "//",
    helloWorld: `fn main() {
    println!("Hello, World!");
}`,
  },
  {
    id: "java",
    name: "Java",
    icon: "Coffee",
    color: "from-red-500 to-orange-500",
    extension: "java",
    frameworks: {
      web: "Spring Boot",
      api: "Spring",
      mobile: "Android",
      desktop: "JavaFX",
    },
    fileNaming: "camel",
    commentSyntax: "//",
    helloWorld: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}`,
  },
  {
    id: "csharp",
    name: "C#",
    icon: "Hash",
    color: "from-purple-500 to-violet-500",
    extension: "cs",
    frameworks: {
      web: "ASP.NET",
      api: "ASP.NET Web API",
      mobile: "Xamarin",
      desktop: "WPF",
    },
    fileNaming: "pascal",
    commentSyntax: "//",
    helloWorld: `using System;

class Program {
    static void Main() {
        Console.WriteLine("Hello, World!");
    }
}`,
  },
  {
    id: "php",
    name: "PHP",
    icon: "FileCode",
    color: "from-indigo-500 to-purple-500",
    extension: "php",
    frameworks: {
      web: "Laravel",
      api: "Laravel",
      mobile: "none",
      desktop: "none",
    },
    fileNaming: "pascal",
    commentSyntax: "//",
    helloWorld: `<?php
echo "Hello, World!";`,
  },
  {
    id: "ruby",
    name: "Ruby",
    icon: "Gem",
    color: "from-red-500 to-pink-500",
    extension: "rb",
    frameworks: {
      web: "Ruby on Rails",
      api: "Sinatra",
      mobile: "none",
      desktop: "none",
    },
    fileNaming: "snake",
    commentSyntax: "#",
    helloWorld: `puts "Hello, World!"`,
  },
  {
    id: "swift",
    name: "Swift",
    icon: "Smartphone",
    color: "from-orange-500 to-red-500",
    extension: "swift",
    frameworks: {
      web: "Vapor",
      api: "Vapor",
      mobile: "SwiftUI",
      desktop: "SwiftUI",
    },
    fileNaming: "camel",
    commentSyntax: "//",
    helloWorld: `import Swift
print("Hello, World!")`,
  },
  {
    id: "kotlin",
    name: "Kotlin",
    icon: "Smartphone",
    color: "from-purple-500 to-orange-500",
    extension: "kt",
    frameworks: {
      web: "Ktor",
      api: "Ktor",
      mobile: "Android",
      desktop: "Compose",
    },
    fileNaming: "camel",
    commentSyntax: "//",
    helloWorld: `fun main() {
    println("Hello, World!")
}`,
  },
  {
    id: "dart",
    name: "Dart (Flutter)",
    icon: "Smartphone",
    color: "from-blue-500 to-cyan-500",
    extension: "dart",
    frameworks: {
      web: "Flutter Web",
      api: "Shelf",
      mobile: "Flutter",
      desktop: "Flutter",
    },
    fileNaming: "camel",
    commentSyntax: "//",
    helloWorld: `void main() {
  print('Hello, World!');
}`,
  },
];

// ─────────────────────────────────────────────
//  Helper functions
// ─────────────────────────────────────────────

export function getLanguageById(id: LanguageId): LanguageConfig | undefined {
  return LANGUAGES.find((l) => l.id === id);
}

export function getLanguageByExtension(ext: string): LanguageConfig | undefined {
  return LANGUAGES.find((l) => l.extension === ext.toLowerCase());
}

export function getFrameworkForProjectType(
  language: LanguageId,
  projectType: string,
): string | undefined {
  const lang = getLanguageById(language);
  if (!lang) return undefined;

  switch (projectType) {
    case "web":
    case "fullstack":
    case "full_stack":
      return lang.frameworks.web;
    case "mobile":
      return lang.frameworks.mobile;
    case "api":
      return lang.frameworks.api;
    case "desktop":
      return lang.frameworks.desktop;
    default:
      return lang.frameworks.web;
  }
}

// ─────────────────────────────────────────────
//  Language-specific system prompt extension
// ─────────────────────────────────────────────

export function getLanguagePromptExtension(language: LanguageId): string {
  const lang = getLanguageById(language);
  if (!lang) return "";

  const frameworkNotes = Object.entries(lang.frameworks)
    .filter(([_, fw]) => fw !== "none")
    .map(([type, fw]) => `${type}: ${fw}`)
    .join(", ");

  return `

## Language Requirements
- Target language: ${lang.name} (.${lang.extension} files)
- File naming: ${lang.fileNaming} case
- Comments: ${lang.commentSyntax}
- Preferred frameworks: ${frameworkNotes}
- Generate code that follows ${lang.name} best practices and conventions
- Include proper imports/dependencies
- Add ${lang.commentSyntax} comments for complex logic
`;
}

// ─────────────────────────────────────────────
//  File naming helpers
// ─────────────────────────────────────────────

export function toPascalCase(str: string): string {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => word.toUpperCase())
    .replace(/\s+/g, "");
}

export function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export function toSnakeCase(str: string): string {
  return str
    .replace(/\s+/g, "_")
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "");
}

export function toKebabCase(str: string): string {
  return str
    .replace(/\s+/g, "-")
    .replace(/([A-Z])/g, "-$1")
    .toLowerCase()
    .replace(/^-/, "");
}

export function formatFileName(
  name: string,
  convention: LanguageConfig["fileNaming"],
): string {
  switch (convention) {
    case "pascal":
      return toPascalCase(name);
    case "camel":
      return toCamelCase(name);
    case "snake":
      return toSnakeCase(name);
    case "kebab":
      return toKebabCase(name);
    default:
      return name;
  }
}
