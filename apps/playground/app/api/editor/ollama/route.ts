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

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "gemma3:4b";

//* Ollama AI provider — calls the playground's /api/editor/ollama route.
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

  const fullPrompt = context
    ? `Context:\n${context}\n\nTask:\n${prompt}`
    : prompt;

  const defaultSystemPrompt =
    "You are a helpful writing assistant. Respond with well-formatted Markdown. Be concise and direct.";

  let response: Response;
  try {
    response = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: fullPrompt,
        system: systemPrompt ?? defaultSystemPrompt,
        stream: true,
        ...(temperature != null && {
          options: {
            temperature,
            ...(maxTokens != null && { num_predict: maxTokens }),
          },
        }),
        ...(temperature == null && maxTokens != null && {
          options: { num_predict: maxTokens },
        }),
      }),
    });
  } catch {
    return new Response(
      JSON.stringify({
        error: `Cannot connect to Ollama at ${OLLAMA_HOST}. Is Ollama running?`,
      }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    return new Response(
      JSON.stringify({
        error: `Ollama error: ${response.status}`,
        details: errorText,
      }),
      {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // Transform the Ollama NDJSON stream into a plain text stream
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

          // Parse NDJSON (one JSON object per line)
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            try {
              const parsed = JSON.parse(trimmed) as {
                response?: string;
                done?: boolean;
              };
              if (parsed.response) {
                controller.enqueue(
                  new TextEncoder().encode(parsed.response),
                );
              }
            } catch {
              // Skip malformed JSON lines
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
