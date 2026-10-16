import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      reportsDirectory: "./coverage",
      include: ["src/lib/**/*.ts", "src/app/**/*.ts", "src/domain/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/assets/**"],
    },
  },
  resolve: {
    alias: {
      "@": path.join(root, "src"),
    },
  },
});
