export default function ApiHome() {
  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem", maxWidth: 720 }}>
      <h1>NorthTap API</h1>
      <p>
        Shared reference catalog + <strong>stateless</strong> recommendation
        computation. Contract: <code>docs/api/openapi.yaml</code>
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
          <code>POST /v1/recommendations</code> — server-side{" "}
          <code>recommendCards()</code> /{" "}
          <code>recommendCardsForMerchant()</code> given caller-supplied{" "}
          <code>ownedCardIds</code>
        </li>
      </ul>
      <p>
        Authenticate with <code>X-Api-Key</code>. This service never accepts
        Supabase JWTs and never reads <code>user_cards</code> — wallet ownership
        stays on Supabase Auth + RLS in client apps.
      </p>
    </main>
  );
}
