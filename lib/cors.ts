const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, Mcp-Session-Id",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
  "Access-Control-Max-Age": "86400",
};

/** Return a 204 preflight response with CORS headers. */
export function corsPreflightResponse(request: Request): Response {
  // Echo the requested headers if the browser asks for specific ones
  const requestedHeaders = request.headers.get(
    "access-control-request-headers",
  );
  const headers = { ...CORS_HEADERS };
  if (requestedHeaders) {
    headers["Access-Control-Allow-Headers"] = requestedHeaders;
  }
  return new Response(null, { status: 204, headers });
}

/** Clone a Response with CORS headers added. */
export function withCors(response: Response): Response {
  const patched = new Response(response.body, response);
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    patched.headers.set(k, v);
  }
  return patched;
}
