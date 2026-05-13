/**
 * Fetches and parses a Shopify store's sitemap to extract all public URLs.
 * Shopify's sitemap.xml is a sitemap index pointing to sub-sitemaps.
 */

interface SitemapUrl {
  loc: string;
  pageType: string;
}

function extractUrls(xml: string): string[] {
  const urls: string[] = [];
  const locRegex = /<loc>\s*(.*?)\s*<\/loc>/g;
  let match;
  while ((match = locRegex.exec(xml)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

function guessPageType(url: string): string {
  const path = new URL(url).pathname;
  if (path === "/") return "homepage";
  if (path.startsWith("/products/")) return "product";
  if (path.startsWith("/collections/")) return "collection";
  if (path.startsWith("/pages/")) return "page";
  if (path.startsWith("/blogs/")) return "blog";
  if (path.startsWith("/account/")) return "account";
  return "page";
}

export async function fetchSitemapUrls(shop: string): Promise<SitemapUrl[]> {
  const baseUrl = `https://${shop}`;
  const results: SitemapUrl[] = [];

  try {
    // Fetch the main sitemap index
    const res = await fetch(`${baseUrl}/sitemap.xml`, {
      headers: { "User-Agent": "SpeedAuditBot/1.0" },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      results.push({ loc: baseUrl, pageType: "homepage" });
    } else {

    const xml = await res.text();

    // Check if it's a sitemap index (contains <sitemapindex>)
    if (xml.includes("<sitemapindex")) {
      const subSitemapUrls = extractUrls(xml);

      // Fetch each sub-sitemap in parallel (limit to first 10)
      const fetches = subSitemapUrls.slice(0, 10).map(async (subUrl) => {
        try {
          const subRes = await fetch(subUrl, {
            headers: { "User-Agent": "SpeedAuditBot/1.0" },
            signal: AbortSignal.timeout(10000),
          });
          if (!subRes.ok) return [];
          const subXml = await subRes.text();
          return extractUrls(subXml);
        } catch {
          return [];
        }
      });

      const allUrlArrays = await Promise.all(fetches);
      for (const urls of allUrlArrays) {
        for (const url of urls) {
          results.push({ loc: url, pageType: guessPageType(url) });
        }
      }
    } else {
      // It's a regular sitemap
      for (const url of extractUrls(xml)) {
        results.push({ loc: url, pageType: guessPageType(url) });
      }
    }
    }
  } catch {
    // Fallback: just the homepage
    results.push({ loc: baseUrl, pageType: "homepage" });
  }

  // Always ensure homepage is first
  const hasHomepage = results.some(
    (r) => new URL(r.loc).pathname === "/"
  );
  if (!hasHomepage) {
    results.unshift({ loc: baseUrl, pageType: "homepage" });
  }

  // Add dynamic pages (not in sitemaps but publicly auditable)
  results.push(
    { loc: `${baseUrl}/cart`, pageType: "cart" },
    { loc: `${baseUrl}/search`, pageType: "page" },
    { loc: `${baseUrl}/account/login`, pageType: "account" },
    { loc: `${baseUrl}/account/register`, pageType: "account" },
    { loc: `${baseUrl}/404`, pageType: "page" },
  );

  return results;
}
