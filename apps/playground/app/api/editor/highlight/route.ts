import { codeToHtml } from "shiki";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  let body: { code?: string; language?: string };
  try {
    body = (await request.json()) as { code?: string; language?: string };
  } catch {
    return Response.json({ html: "" });
  }
  const code = typeof body.code === "string" ? body.code : "";
  const language = typeof body.language === "string" ? body.language : "text";

  if (!code.trim()) {
    return Response.json({ html: "" });
  }

  try {
    const html = await codeToHtml(code, {
      lang: language,
      theme: "github-light",
    });

    return Response.json({ html });
  } catch {
    // Unknown language or Shiki error — fall back to "text"
    try {
      const html = await codeToHtml(code, {
        lang: "text",
        theme: "github-light",
      });
      return Response.json({ html });
    } catch {
      return Response.json({ html: "" });
    }
  }
}
