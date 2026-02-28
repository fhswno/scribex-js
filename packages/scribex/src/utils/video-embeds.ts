/**
 * Video embed URL parser.
 * Extracts provider-specific embed URLs from user-pasted video links.
 * Pure function — no React, no side effects.
 */

export interface VideoEmbedInfo {
  provider: "youtube" | "vimeo" | "loom" | "generic";
  embedUrl: string;
  /** Thumbnail URL when available (YouTube, Vimeo). */
  thumbnailUrl?: string;
}

/**
 * Parse a URL string and return embed info for known video providers.
 * Returns `null` for non-URL strings. Returns `{ provider: "generic" }` for
 * unrecognized but valid URLs, so any iframe-compatible link works.
 */
export function parseVideoEmbed(url: string): VideoEmbedInfo | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Validate it looks like a URL
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  const hostname = parsed.hostname.replace(/^www\./, "");

  // ── YouTube ─────────────────────────────────────────────────────────
  // youtube.com/watch?v=ID, youtube.com/embed/ID, youtube.com/shorts/ID,
  // youtube.com/live/ID, youtube.com/v/ID, youtu.be/ID
  if (hostname === "youtube.com" || hostname === "m.youtube.com") {
    let videoId: string | null = null;

    // /watch?v=ID
    if (parsed.pathname === "/watch") {
      videoId = parsed.searchParams.get("v");
    }

    // /embed/ID, /shorts/ID, /live/ID, /v/ID
    if (!videoId) {
      const pathMatch = parsed.pathname.match(
        /^\/(embed|shorts|live|v)\/([a-zA-Z0-9_-]+)/,
      );
      if (pathMatch) {
        videoId = pathMatch[2] ?? null;
      }
    }

    if (videoId) {
      return {
        provider: "youtube",
        embedUrl: `https://www.youtube.com/embed/${videoId}`,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      };
    }
  }

  if (hostname === "youtu.be") {
    const videoId = parsed.pathname.slice(1).split("/")[0];
    if (videoId) {
      return {
        provider: "youtube",
        embedUrl: `https://www.youtube.com/embed/${videoId}`,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      };
    }
  }

  // ── Vimeo ───────────────────────────────────────────────────────────
  // vimeo.com/ID, vimeo.com/channels/*/ID, player.vimeo.com/video/ID
  if (hostname === "vimeo.com" || hostname === "player.vimeo.com") {
    const vimeoMatch = parsed.pathname.match(/\/(?:video\/|channels\/[^/]+\/)?(\d+)/);
    if (vimeoMatch) {
      const videoId = vimeoMatch[1];
      return {
        provider: "vimeo",
        embedUrl: `https://player.vimeo.com/video/${videoId}`,
      };
    }
  }

  // ── Loom ────────────────────────────────────────────────────────────
  // loom.com/share/ID, loom.com/embed/ID
  if (hostname === "loom.com") {
    const loomMatch = parsed.pathname.match(/\/(?:share|embed)\/([a-zA-Z0-9]+)/);
    if (loomMatch) {
      const videoId = loomMatch[1];
      return {
        provider: "loom",
        embedUrl: `https://www.loom.com/embed/${videoId}`,
      };
    }
  }

  // ── Generic ─────────────────────────────────────────────────────────
  return {
    provider: "generic",
    embedUrl: trimmed,
  };
}
