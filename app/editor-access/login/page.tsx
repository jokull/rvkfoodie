import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "cloudflare:workers";
import { getEditorPassword } from "@/lib/editor-proxy";
import { getCmsHandler } from "@/lib/cms-handler";

export default async function EditorLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; error?: string }>;
}) {
  const { returnTo = "/", error } = await searchParams;

  async function login(formData: FormData) {
    "use server";

    const name = formData.get("name")?.toString().trim();
    const password = formData.get("password")?.toString();
    const returnTo = formData.get("returnTo")?.toString() ?? "/";

    if (!name || password !== getEditorPassword()) {
      redirect(
        `/editor-access/login?returnTo=${encodeURIComponent(returnTo)}&error=${encodeURIComponent("Wrong password")}`,
      );
    }

    const writeKey = env.CMS_WRITE_KEY;
    const cms = getCmsHandler();
    const tokenResponse = await cms.fetch(
      new Request("http://localhost/api/tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${writeKey}`,
        },
        body: JSON.stringify({ name, expiresIn: 31_536_000 }), // 1 year
      }),
    );

    if (!tokenResponse.ok) {
      redirect(
        `/editor-access/login?returnTo=${encodeURIComponent(returnTo)}&error=${encodeURIComponent("Failed to create editor token")}`,
      );
    }

    const { token } = (await tokenResponse.json()) as { token: string };

    const cookieStore = await cookies();
    cookieStore.set("editor_session", `${name}:${token}`, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      maxAge: 31_536_000, // 1 year
    });

    redirect(returnTo);
  }

  return (
    <div className="max-w-sm mx-auto mt-20">
      <h1 className="font-display text-[1.75rem] leading-tight mb-6">
        Editor Login
      </h1>
      {error && <p className="text-red-600 mb-4 text-tiny">{error}</p>}
      <form action={login} className="space-y-4">
        <input type="hidden" name="returnTo" value={returnTo} />
        <label className="block">
          <span className="text-tiny text-ink-light">Your name</span>
          <input
            name="name"
            required
            placeholder="e.g. Jökull"
            className="mt-1 block w-full px-3 py-2 border border-ink/20 rounded-lg text-tiny"
          />
        </label>
        <label className="block">
          <span className="text-tiny text-ink-light">Password</span>
          <input
            name="password"
            type="password"
            required
            className="mt-1 block w-full px-3 py-2 border border-ink/20 rounded-lg text-tiny"
          />
        </label>
        <button
          type="submit"
          className="bg-blue text-white font-medium px-6 py-2.5 rounded-full text-tiny hover:opacity-90 transition-opacity"
        >
          Log in
        </button>
      </form>
    </div>
  );
}
