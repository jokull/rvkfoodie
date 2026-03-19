export function GET() {
  return new Response(null, {
    status: 302,
    headers: {
      "Set-Cookie":
        "editor_session=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0",
      Location: "/",
    },
  });
}
