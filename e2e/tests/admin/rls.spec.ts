import { expect, test } from "../../src/fixtures";
import {
  ADMIN_DATA_TABLES,
  appUserAdminRole,
  countAsAppUser,
} from "../../src/helpers/admin-data";

test.describe("admin RLS for app users", () => {
  test("app user is not an admin and sees no admin data", async () => {
    const role = await appUserAdminRole();
    expect(role.isAdmin).toBe(false);
    expect(role.role).toBeNull();

    for (const table of ADMIN_DATA_TABLES) {
      expect(await countAsAppUser(table), table).toBe(0);
    }
  });
});
