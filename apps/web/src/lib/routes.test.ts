import { describe, expect, it } from "vitest";
import { APP_PATH } from "./routes";

describe("APP_PATH", () => {
  it("points at the deployed Expo web app, not an in-repo /app route", () => {
    expect(APP_PATH).toBe("https://northtap-app.vercel.app");
    expect(APP_PATH.startsWith("http")).toBe(true);
  });
});
