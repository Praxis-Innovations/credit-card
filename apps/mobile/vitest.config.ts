import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@northtap/core": path.resolve(__dirname, "../../packages/core/src/index.ts"),
    },
  },
});
