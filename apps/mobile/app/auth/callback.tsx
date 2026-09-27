import { Redirect } from "expo-router";

/**
 * Native deep link target for Google sign-in (northtap://auth/callback).
 * The in-app auth session consumes the tokens; this route only makes sure a
 * stray deep link lands back on the result instead of "unmatched route".
 */
export default function AuthCallback() {
  return <Redirect href="/result" />;
}
