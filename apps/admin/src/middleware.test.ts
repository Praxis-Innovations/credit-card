import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };
type CookieMethods = { setAll: (cookies: CookieToSet[]) => void };

const fake = {
  auth: {
    getUser: vi.fn(),
    getSession: vi.fn(),
    signOut: vi.fn(),
  },
  rpc: vi.fn(),
};
let cookieMethods: CookieMethods;

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn((_url: string, _key: string, opts: { cookies: CookieMethods }) => {
    cookieMethods = opts.cookies;
    return fake;
  }),
}));

const { middleware } = await import("./middleware");

const ORIGIN = "http://localhost:3100";

function request(path: string) {
  return new NextRequest(`${ORIGIN}${path}`);
}

function signedInAs(email: string, role: string | null, rpcError = false) {
  fake.auth.getUser.mockResolvedValue({ data: { user: { id: "u1", email } }, error: null });
  fake.rpc.mockResolvedValue(
    rpcError ? { data: null, error: { message: "boom" } } : { data: role, error: null },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
  process.env.ADMIN_ORIGIN = ORIGIN;
  fake.auth.signOut.mockImplementation(async () => {
    cookieMethods.setAll([{ name: "sb-project-auth-token", value: "", options: { maxAge: 0 } }]);
    return { error: null };
  });
});

describe("middleware auth guard", () => {
  it.each(["/sources", "/", "/anything/else", "/login-but-not-really"])(
    "redirects %s to /login when there is no session",
    async (path) => {
      fake.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: "no session" } });
      const res = await middleware(request(path));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe(`${ORIGIN}/login`);
      expect(fake.rpc).not.toHaveBeenCalled();
    },
  );

  it("verifies the session with getUser, never getSession alone", async () => {
    signedInAs("info.praxisinnovations@gmail.com", "admin");
    await middleware(request("/sources"));
    expect(fake.auth.getUser).toHaveBeenCalledTimes(1);
    expect(fake.auth.getSession).not.toHaveBeenCalled();
  });

  it("lets an allow-listed user through", async () => {
    signedInAs("info.praxisinnovations@gmail.com", "admin");
    const res = await middleware(request("/sources"));
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(fake.rpc).toHaveBeenCalledWith("current_admin_role");
    expect(fake.auth.signOut).not.toHaveBeenCalled();
  });

  it("signs out a user who is not on the allow-list and sends them to /not-authorized", async () => {
    signedInAs("someone@example.com", null);
    const res = await middleware(request("/sources"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/not-authorized`);
    expect(fake.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    const cleared = res.cookies.get("sb-project-auth-token");
    expect(cleared?.value).toBe("");
  });

  it("treats a failed role lookup as not authorized", async () => {
    signedInAs("info.praxisinnovations@gmail.com", null, true);
    const res = await middleware(request("/sources"));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/not-authorized`);
    expect(fake.auth.signOut).toHaveBeenCalled();
  });

  it("rejects a role value that isn't a console role", async () => {
    signedInAs("someone@example.com", "superuser");
    const res = await middleware(request("/sources"));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/not-authorized`);
  });

  it.each(["/login", "/auth/callback", "/not-authorized"])(
    "leaves %s public",
    async (path) => {
      const res = await middleware(request(path));
      expect(res.headers.get("location")).toBeNull();
      expect(fake.auth.getUser).not.toHaveBeenCalled();
    },
  );
});
