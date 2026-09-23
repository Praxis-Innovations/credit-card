export default function ApiHome() {
  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem", maxWidth: 720 }}>
      <h1>NorthTap API</h1>
      <p>
        Standalone public catalog + <strong>stateless</strong> recommendation
        API. Domain engine lives in <code>apps/api/src/domain</code>. Contract:{" "}
        <code>docs/api/openapi.yaml</code>
      </p>
      <ul>
        <li>
          <code>GET /v1/health</code> — liveness (no auth)
        </li>
        <li>
          <code>GET /v1/cards</code> (+ brands, partnerships, …) — shared
          catalog
        </li>
        <li>
          <code>POST /v1/recommendations</code> — server-side ranking; optional{" "}
          <code>merchantQuery</code> resolved against merchant brands here
        </li>
      </ul>
      <p>
        Authenticate with <code>X-Api-Key</code>. This service never accepts
        Supabase JWTs and never reads <code>user_cards</code>. Client apps
        (Expo) are HTTP-only consumers — no domain package dependency.
      </p>
    </main>
  );
}
