// FUMADOCS
import { createFromSource } from "fumadocs-core/search/server";
import type { SortedResult } from "fumadocs-core/search/server";

// LIB
import { source } from "@/lib/source";

// API
const api = createFromSource(source);

//* Used to search for content across the documentation. Results are grouped by page, and pages whose title matches the query come first.
export async function GET(request: Request): Promise<Response> {
  // URL & Query
  const url: URL = new URL(request.url);
  const query = url.searchParams.get("query");

  // Case - No Query
  if (!query) return Response.json([]);

  // Optional Filters
  const tagParam = url.searchParams.get("tag");
  const localeParam = url.searchParams.get("locale");

  // Search
  const results = await api.search(query, {
    tag: tagParam ? tagParam.split(",") : undefined,
    locale: localeParam || undefined,
  });

  // Group results by page
  const groups: SortedResult[][] = [];
  let current: SortedResult[] = [];

  // Start a new group whenever we encounter a page result. This ensures that all content results are grouped under their respective page.
  for (const result of results) {
    if (result.type === "page") {
      if (current.length > 0) groups.push(current);
      current = [result];
    } else {
      current.push(result);
    }
  }

  // Push the last group if it exists
  if (current.length > 0) groups.push(current);

  // Re-sort: pages whose title matches the query come first
  const q = query.toLowerCase();

  // Sort groups based on the title of the first page result in each group. If the title matches the query, it comes first. If it includes the query, it also comes before non-matching titles.
  groups.sort((a: SortedResult[], b: SortedResult[]) => {
    const aFirst = a[0];
    const bFirst = b[0];

    const aTitle = aFirst && aFirst.content ? aFirst.content.toLowerCase() : "";
    const bTitle = bFirst && bFirst.content ? bFirst.content.toLowerCase() : "";

    const aMatch = aTitle === q || aTitle.includes(q);
    const bMatch = bTitle === q || bTitle.includes(q);

    if (aMatch && !bMatch) return -1;
    if (!aMatch && bMatch) return 1;
    return 0;
  });

  return Response.json(groups.flat());
}
