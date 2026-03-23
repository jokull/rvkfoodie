import { cookies } from "next/headers";

export async function PreviewBanner() {
  const cookieStore = await cookies();
  const preview = cookieStore.get("__preview")?.value;
  if (!preview) return null;

  return (
    <div className="bg-blue text-white text-tiny text-center py-2 px-4">
      Preview mode{" "}
      <a href="/api/draft-mode/disable" className="underline opacity-80 hover:opacity-100">
        Exit
      </a>
    </div>
  );
}
