// NEXT
import { NextRequest } from "next/server";

// ZOD
import { z } from "zod";

// SCHEMA
const RequestSchema = z.object({
  prompt: z.string().min(1).max(10000),
  context: z.string().max(50000),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(100000).optional(),
  systemPrompt: z.string().max(10000).optional(),
});

//* Mistral AI provider — calls the playground's /api/editor/mistral route.
export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = RequestSchema.safeParse(body);

  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { prompt, context, temperature, maxTokens, systemPrompt } = parsed.data;

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "MISTRAL_API_KEY not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const defaultSystemPrompt =
    "You are a helpful writing assistant. Respond with well-formatted Markdown. Be concise and direct.";

  const response = await fetch(
    "https://api.mistral.ai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "ministral-3b-latest",
        stream: true,
        ...(temperature != null && { temperature }),
        ...(maxTokens != null && { max_tokens: maxTokens }),
        messages: [
          {
            role: "system",
            content: systemPrompt ?? defaultSystemPrompt,
          },
          {
            role: "user",
            content: context
              ? `Context:\n${context}\n\nTask:\n${prompt}`
              : prompt,
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    return new Response(
      JSON.stringify({ error: `Mistral API error: ${response.status}`, details: errorText }),
      { status: response.status, headers: { "Content-Type": "application/json" } },
    );
  }

  // Transform the Mistral SSE stream into a plain text stream
  const readableStream = new ReadableStream({
    async start(controller) {
      const reader = response.body?.getReader();
      if (!reader) {
        controller.close();
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;

            const data = trimmed.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data) as {
                choices?: Array<{
                  delta?: { content?: string };
                }>;
              };
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                controller.enqueue(new TextEncoder().encode(content));
              }
            } catch {
              // Skip malformed JSON chunks
            }
          }
        }
      } catch (err) {
        controller.error(err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readableStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}
