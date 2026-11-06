import type { APIRoute } from "astro";

// Open pages compare this with the version they were loaded with (BaseLayout).
export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({ version: import.meta.env.PUBLIC_COMMIT_SHA ?? null }),
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
