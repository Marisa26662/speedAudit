import type { StoredPSIData, PSIAuditResult, PSIAuditItem } from "./types";

const PSI_API = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

const MAX_ITEMS = 10;

function extractItems(details: Record<string, unknown> | undefined): PSIAuditItem[] | undefined {
  if (!details) return undefined;
  const rawItems = details.items as Array<Record<string, unknown>> | undefined;
  if (!rawItems || rawItems.length === 0) return undefined;

  return rawItems.slice(0, MAX_ITEMS).map((item): PSIAuditItem => {
    const result: PSIAuditItem = {};

    if (typeof item.url === "string") result.url = item.url;
    if (typeof item.label === "string") result.label = item.label;

    if (typeof item.totalBytes === "number") result.totalBytes = item.totalBytes;
    if (typeof item.wastedBytes === "number") result.wastedBytes = item.wastedBytes;
    if (typeof item.wastedMs === "number") result.wastedMs = item.wastedMs;
    if (typeof item.wastedPercent === "number") result.wastedPercent = Math.round(item.wastedPercent * 10) / 10;
    if (typeof item.mimeType === "string") result.mimeType = item.mimeType;

    const node = item.node as Record<string, unknown> | undefined;
    if (node) {
      result.node = {
        selector: typeof node.selector === "string" ? node.selector : "",
        snippet: typeof node.snippet === "string" ? node.snippet.slice(0, 200) : "",
      };
    }
    if (typeof item.selector === "string") result.selector = item.selector;
    if (typeof item.snippet === "string") result.snippet = item.snippet.slice(0, 200);

    return result;
  }).filter((item) => item.url || item.label || item.node || item.selector || item.snippet);
}

function safeAudit(audits: Record<string, unknown>, key: string): PSIAuditResult {
  const a = audits[key] as Record<string, unknown> | undefined;
  if (!a) return { score: null };

  const details = a.details as Record<string, unknown> | undefined;
  const rawItems = details?.items as unknown[] | undefined;
  const overallSavingsBytes = details?.overallSavingsBytes as number | undefined;
  const overallSavingsMs = details?.overallSavingsMs as number | undefined;

  const items = extractItems(details);

  return {
    score: typeof a.score === "number" ? a.score : null,
    savingsBytes: overallSavingsBytes,
    savingsMs: overallSavingsMs,
    displayValue: typeof a.displayValue === "string" ? a.displayValue : undefined,
    itemCount: rawItems ? rawItems.length : undefined,
    items: items && items.length > 0 ? items : undefined,
  };
}

function safeMetric(audits: Record<string, unknown>, key: string): { value: number; displayValue: string } {
  const a = audits[key] as Record<string, unknown> | undefined;
  return {
    value: typeof a?.numericValue === "number" ? a.numericValue : 0,
    displayValue: typeof a?.displayValue === "string" ? a.displayValue : "–",
  };
}

export function extractScreenshotDataUri(audits: Record<string, unknown>): string | null {
  const fs = audits["final-screenshot"] as Record<string, unknown> | undefined;
  if (!fs) return null;
  const details = fs.details as Record<string, unknown> | undefined;
  if (!details) return null;
  const data = details.data as string | undefined;
  if (!data || !data.startsWith("data:image/")) return null;
  return data;
}

export async function runPageSpeedAnalysis(
  url: string,
  strategy: "mobile" | "desktop" = "mobile",
  apiKey?: string | null,
): Promise<{ psi: StoredPSIData; screenshotDataUri: string | null } | null> {
  const key = apiKey || process.env.PAGESPEED_API_KEY;

  const params = new URLSearchParams({
    url,
    strategy,
    category: "performance",
  });
  params.append("category", "seo");
  params.append("category", "accessibility");
  params.append("category", "best-practices");
  if (key) params.set("key", key);

  try {
    const res = await fetch(`${PSI_API}?${params.toString()}`, {
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      console.error(`PSI API error: ${res.status} ${res.statusText}`);
      return null;
    }

    const data = await res.json() as Record<string, unknown>;
    const lr = data.lighthouseResult as Record<string, unknown>;
    if (!lr) return null;

    const categories = lr.categories as Record<string, { score: number }>;
    const audits = lr.audits as Record<string, unknown>;

    const score = (key: string) => Math.round((categories[key]?.score ?? 0) * 100);

    const screenshotDataUri = extractScreenshotDataUri(audits);

    return { screenshotDataUri, psi: {
      performanceScore: score("performance"),
      seoScore: score("seo"),
      accessibilityScore: score("accessibility"),
      bestPracticesScore: score("best-practices"),
      metrics: {
        fcp: safeMetric(audits, "first-contentful-paint"),
        lcp: safeMetric(audits, "largest-contentful-paint"),
        tbt: safeMetric(audits, "total-blocking-time"),
        cls: safeMetric(audits, "cumulative-layout-shift"),
        si: safeMetric(audits, "speed-index"),
        tti: safeMetric(audits, "interactive"),
        ttfb: safeMetric(audits, "server-response-time"),
      },
      audits: {
        renderBlocking: safeAudit(audits, "render-blocking-resources"),
        unusedCss: safeAudit(audits, "unused-css-rules"),
        unusedJs: safeAudit(audits, "unused-javascript"),
        imageOptimization: safeAudit(audits, "efficiently-encode-images"),
        webpImages: safeAudit(audits, "uses-webp-images"),
        responsiveImages: safeAudit(audits, "uses-responsive-images"),
        offscreenImages: safeAudit(audits, "offscreen-images"),
        documentTitle: safeAudit(audits, "document-title"),
        metaDescription: safeAudit(audits, "meta-description"),
        isCrawlable: safeAudit(audits, "is-crawlable"),
        robotsTxt: safeAudit(audits, "robots-txt"),
        canonical: safeAudit(audits, "canonical"),
        structuredData: safeAudit(audits, "structured-data"),
        tapTargets: safeAudit(audits, "tap-targets"),
        linkText: safeAudit(audits, "link-text"),
        imageAlt: safeAudit(audits, "image-alt"),
        htmlLang: safeAudit(audits, "html-has-lang"),
        metaViewport: safeAudit(audits, "meta-viewport"),
        colorContrast: safeAudit(audits, "color-contrast"),
        buttonName: safeAudit(audits, "button-name"),
        formLabels: safeAudit(audits, "label"),
        usesHttps: safeAudit(audits, "uses-https"),
        noDocumentWrite: safeAudit(audits, "no-document-write"),
        doctype: safeAudit(audits, "doctype"),
        charset: safeAudit(audits, "charset"),
        deprecations: safeAudit(audits, "deprecations"),
      },
      strategy,
      lighthouseVersion: typeof lr.lighthouseVersion === "string" ? lr.lighthouseVersion : "unknown",
      fetchTime: typeof lr.fetchTime === "string" ? lr.fetchTime : new Date().toISOString(),
    }};
  } catch (err) {
    console.error("PSI analysis failed:", err);
    return null;
  }
}
