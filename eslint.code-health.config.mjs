/**
 * Size and complexity rules for AU1 code-health checks.
 * Separate from per-app lint configs so CI can baseline these without
 * changing day-to-day app lint behaviour.
 */
import js from "@eslint/js";
import tseslint from "typescript-eslint";

const sizeComplexityRules = {
  complexity: ["error", 15],
  "max-depth": ["error", 4],
  "max-lines": ["error", 400],
  "max-lines-per-function": [
    "error",
    { max: 80, skipBlankLines: true, skipComments: true },
  ],
  "max-nested-callbacks": ["error", 3],
  "max-params": ["error", 5],
};

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/.expo/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/*.config.{js,mjs,cjs,ts}",
      "**/next-env.d.ts",
      "code-health/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["apps/**/*.{ts,tsx}", "scripts/**/*.{ts,tsx}"],
    rules: {
      ...sizeComplexityRules,
      // Keep this pass focused on size/complexity; quiet unrelated recommended noise.
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "no-unused-vars": "off",
      "no-undef": "off",
      "no-redeclare": "off",
      "prefer-const": "off",
      "no-empty": "off",
      "no-useless-assignment": "off",
    },
  },
);
