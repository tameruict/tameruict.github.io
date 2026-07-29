import { getCollection } from "astro:content";

const escapeXml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

export async function GET({ site }) {
  const base = site ?? new URL("https://tameruict.github.io");
  const posts = (await getCollection("writeups", ({ data }) => !data.draft)).sort(
    (a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime(),
  );

  const items = posts
    .map(({ id, data }) => {
      const url = new URL(`/writeups/${id}/`, base).href;

      return [
        "    <item>",
        `      <title>${escapeXml(data.title)}</title>`,
        `      <description>${escapeXml(data.description)}</description>`,
        `      <link>${escapeXml(url)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
        `      <pubDate>${data.publishedAt.toUTCString()}</pubDate>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "  <channel>",
    "    <title>Tameru Write-ups</title>",
    "    <description>Write-up CTF của Tameru.</description>",
    `    <link>${escapeXml(base.href)}</link>`,
    "    <language>vi</language>",
    items,
    "  </channel>",
    "</rss>",
  ].join("\n");

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
}
