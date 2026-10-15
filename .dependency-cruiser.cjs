/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-cross-app-imports",
      severity: "error",
      comment:
        "Apps must not import from another app. Talk over HTTP, Supabase, or shared docs contracts.",
      from: { path: "^apps/([^/]+)/" },
      to: {
        path: "^apps/([^/]+)/",
        pathNot: "^apps/$1/",
      },
    },
    {
      name: "no-service-key-modules-outside-server",
      severity: "error",
      comment:
        "Modules that hold the Supabase service role client/key may only be imported from server code (api, crawler).",
      from: {
        pathNot: "^(apps/api/|apps/crawler/|scripts/)",
        path: "\\.(ts|tsx|js|mjs)$",
      },
      to: {
        path: "(apps/api/src/lib/(auth|catalog)\\.ts|apps/api/src/data-pipeline/|apps/crawler/src/store\\.ts)",
      },
    },
  ],
  options: {
    doNotFollow: {
      path: ["node_modules", "\\.next", "dist", "\\.expo", "coverage"],
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: "tsconfig.base.json",
    },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
