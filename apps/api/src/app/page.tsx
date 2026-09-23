export default function ApiHome() {
  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem", maxWidth: 640 }}>
      <h1>NorthTap API</h1>
      <p>
        Public catalog + recommendation API. Contract:{" "}
        <code>docs/api/openapi.yaml</code>
      </p>
      <ul>
        <li>
          <code>GET /v1/health</code> — liveness (no auth)
        </li>
        <li>
          <code>GET /v1/cards</code> — catalog (API key required)
        </li>
        <li>
          <code>POST /v1/recommendations</code> — rank cards (API key required)
        </li>
      </ul>
      <p>Authenticate with <code>X-Api-Key</code> or <code>Authorization: Bearer</code>.</p>
    </main>
  );
}
