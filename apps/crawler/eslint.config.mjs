import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["node_modules/**", "output/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/apps/*/**", "web/*", "mobile/*", "admin/*", "api/*"],
              message: "apps/crawler is standalone; talk to other apps through the database only.",
            },
          ],
        },
      ],
    },
  },
);
