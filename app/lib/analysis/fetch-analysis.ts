import type { FetchAnalysisData, SecurityHeaders, OpenGraphData } from "./types";
import { detectTechnologies } from "./tech-detection";

function extractMeta(html: string, name: string): string | null {
  const patterns = [
    new RegExp(`<meta\\s+name=["']${name}["']\\s+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta\\s+content=["']([^"']*)["']\\s+name=["']${name}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1];
  }
  return null;
}

function extractOGMeta(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`<meta\\s+property=["']og:${property}["']\\s+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta\\s+content=["']([^"']*)["']\\s+property=["']og:${property}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1];
  }
  return null;
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m ? m[1].trim() : null;
}

function extractCanonical(html: string): string | null {
  const m = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)
    ?? html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
  return m ? m[1] : null;
}

function extractLang(html: string): string | null {
  const m = html.match(/<html[^>]+lang=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

function extractCharset(html: string): string | null {
  const m = html.match(/<meta[^>]+charset=["']?([^"'\s>]+)/i);
  return m ? m[1] : null;
}

function countH1s(html: string): string[] {
  const results: string[] = [];
  const re = /<h1[^>]*>([\s\S]*?)<\/h1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    results.push(m[1].replace(/<[^>]+>/g, "").trim());
  }
  return results;
}

function countH2s(html: string): string[] {
  const results: string[] = [];
  const re = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    results.push(m[1].replace(/<[^>]+>/g, "").trim().slice(0, 100));
  }
  return results.slice(0, 10);
}

function countImages(html: string): { total: number; missingAlt: number } {
  const imgRe = /<img[^>]*>/gi;
  const altRe = /\balt=["']([^"']*)["']/i;
  let total = 0;
  let missingAlt = 0;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(html)) !== null) {
    total++;
    const tag = m[0];
    const altMatch = tag.match(altRe);
    if (!altMatch || altMatch[1].trim() === "") missingAlt++;
  }
  return { total, missingAlt };
}

function countLinks(html: string, baseUrl: string): { internal: number; external: number; internalUrls: string[] } {
  const re = /<a[^>]+href=["']([^"'#?]+)["']/gi;
  const host = new URL(baseUrl).hostname;
  const origin = new URL(baseUrl).origin;
  let internal = 0;
  let external = 0;
  const internalUrls: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    if (href.startsWith("/")) {
      internal++;
      try {
        internalUrls.push(new URL(href, origin).href);
      } catch { /* skip invalid */ }
    } else if (href.includes(host) && href.startsWith("http")) {
      internal++;
      internalUrls.push(href);
    } else if (href.startsWith("http")) {
      external++;
    }
  }
  return { internal, external, internalUrls };
}

function countWords(html: string): number {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.split(" ").filter((w) => w.length > 2).length;
}

function extractStructuredData(html: string): { has: boolean; types: string[] } {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const types: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(m[1]);
      const type = parsed["@type"];
      if (type) types.push(Array.isArray(type) ? type[0] : type);
    } catch {
      // ignore malformed JSON-LD
    }
  }
  return { has: types.length > 0, types };
}

export async function runFetchAnalysis(url: string): Promise<FetchAnalysisData> {
  const startTime = Date.now();
  let finalUrl = url;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SpeedAuditBot/1.0)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(30_000),
      redirect: "follow",
    });

    finalUrl = res.url || url;
    const loadTimeMs = Date.now() - startTime;
    const isHttps = finalUrl.startsWith("https://");

    const headers = res.headers;
    const securityHeaders: SecurityHeaders = {
      xContentTypeOptions: !!headers.get("x-content-type-options"),
      xFrameOptions: !!headers.get("x-frame-options"),
      referrerPolicy: !!headers.get("referrer-policy"),
      strictTransportSecurity: !!headers.get("strict-transport-security"),
      contentSecurityPolicy: !!headers.get("content-security-policy"),
      xXssProtection: !!headers.get("x-xss-protection"),
    };

    const contentType = headers.get("content-type") ?? "";
    let html = "";
    if (contentType.includes("text/html")) {
      html = await res.text();
    }

    const title = extractTitle(html);
    const metaDescription = extractMeta(html, "description");
    const canonicalUrl = extractCanonical(html);
    const lang = extractLang(html);
    const charset = extractCharset(html) ?? headers.get("content-type")?.match(/charset=([^\s;]+)/i)?.[1] ?? null;
    const hasViewportMeta = !!extractMeta(html, "viewport");
    const robotsMeta = extractMeta(html, "robots");
    const isIndexable = !robotsMeta?.includes("noindex");

    const h1s = countH1s(html);
    const h2s = countH2s(html);
    const images = countImages(html);
    const links = countLinks(html, finalUrl);
    const wordCount = countWords(html);
    const { has: hasStructuredData, types: structuredDataTypes } = extractStructuredData(html);

    const openGraph: OpenGraphData = {
      title: extractOGMeta(html, "title"),
      description: extractOGMeta(html, "description"),
      image: extractOGMeta(html, "image"),
      url: extractOGMeta(html, "url"),
      type: extractOGMeta(html, "type"),
    };

    const twitterCard = extractMeta(html, "twitter:card");
    const hasTwitterCard = !!twitterCard;

    let hasRobotsTxt = false;
    try {
      const robotsUrl = new URL("/robots.txt", finalUrl).toString();
      const robotsRes = await fetch(robotsUrl, {
        signal: AbortSignal.timeout(5_000),
        redirect: "follow",
      });
      hasRobotsTxt = robotsRes.ok && robotsRes.status === 200;
    } catch {
      hasRobotsTxt = false;
    }

    const headersObj: Record<string, string> = {};
    headers.forEach((value, key) => {
      headersObj[key.toLowerCase()] = value;
    });

    const cookies: string[] = [];
    const setCookieRaw = headers.get("set-cookie");
    if (setCookieRaw) {
      cookies.push(...setCookieRaw.split(/,(?=\s*\w+=)/));
    }

    const technologies = detectTechnologies(html, headersObj);

    let hasSitemap = false;
    let sitemapUrl: string | null = null;

    const sitemapLinkMatch = html.match(/<link[^>]+rel=["']sitemap["'][^>]+href=["']([^"']+)["']/i);
    if (sitemapLinkMatch) {
      sitemapUrl = sitemapLinkMatch[1];
      hasSitemap = true;
    }

    if (!hasSitemap) {
      try {
        const defaultSitemapUrl = new URL("/sitemap.xml", finalUrl).toString();
        const sitemapRes = await fetch(defaultSitemapUrl, {
          signal: AbortSignal.timeout(5_000),
          redirect: "follow",
        });
        if (sitemapRes.ok && sitemapRes.status === 200) {
          hasSitemap = true;
          sitemapUrl = defaultSitemapUrl;
        }
      } catch {
        // ignore
      }
    }

    return {
      url,
      finalUrl,
      statusCode: res.status,
      isHttps,
      loadTimeMs,
      title,
      titleLength: title?.length ?? 0,
      metaDescription,
      metaDescriptionLength: metaDescription?.length ?? 0,
      h1s,
      h2s,
      canonicalUrl,
      hasViewportMeta,
      lang,
      charset,
      openGraph,
      hasTwitterCard,
      hasRobotsTxt,
      hasSitemap,
      sitemapUrl,
      robotsMeta,
      isIndexable,
      imagesTotal: images.total,
      imagesMissingAlt: images.missingAlt,
      internalLinks: links.internal,
      externalLinks: links.external,
      internalLinkUrls: links.internalUrls,
      hasStructuredData,
      structuredDataTypes,
      securityHeaders,
      rawHeaders: headersObj,
      cookies,
      html,
      wordCount,
      technologies,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    return {
      url,
      finalUrl,
      statusCode: 0,
      isHttps: url.startsWith("https://"),
      loadTimeMs: Date.now() - startTime,
      title: null,
      titleLength: 0,
      metaDescription: null,
      metaDescriptionLength: 0,
      h1s: [],
      h2s: [],
      canonicalUrl: null,
      hasViewportMeta: false,
      lang: null,
      charset: null,
      openGraph: { title: null, description: null, image: null, url: null, type: null },
      hasTwitterCard: false,
      hasRobotsTxt: false,
      hasSitemap: false,
      sitemapUrl: null,
      robotsMeta: null,
      isIndexable: true,
      imagesTotal: 0,
      imagesMissingAlt: 0,
      internalLinks: 0,
      externalLinks: 0,
      internalLinkUrls: [],
      hasStructuredData: false,
      structuredDataTypes: [],
      securityHeaders: {
        xContentTypeOptions: false,
        xFrameOptions: false,
        referrerPolicy: false,
        strictTransportSecurity: false,
        contentSecurityPolicy: false,
        xXssProtection: false,
      },
      wordCount: 0,
      error: errorMsg,
    };
  }
}
