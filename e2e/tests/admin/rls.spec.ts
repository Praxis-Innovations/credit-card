import { expect, test } from "../../src/fixtures";
import {
  ADMIN_DATA_TABLES,
  appUserAdminRole,
  countAsAppUser,
  countAsServiceRole,
  ensureAdminRlsFixtures,
} from "../../src/helpers/admin-data";

test.describe("admin RLS for app users", () => {
  test("app user is not an admin and sees no admin data", async () => {
    await ensureAdminRlsFixtures();

    const role = await appUserAdminRole();
    expect(role.isAdmin).toBe(false);
    expect(role.role).toBeNull();

    for (const table of ADMIN_DATA_TABLES) {
      expect(await countAsServiceRole(table), `${table} (service)`).toBeGreaterThan(0);
      expect(await countAsAppUser(table), `${table} (app user)`).toBe(0);
    }
  });
});
