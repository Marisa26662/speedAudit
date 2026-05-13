import { useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, redirect, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import { executeAudit } from "../lib/analysis/run-audit.server";
import { fetchSitemapUrls } from "../lib/sitemap.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;
  const baseUrl = `https://${shop}`;

  const [settings, sitemapUrls, adminUrls, isPasswordProtected] = await Promise.all([
    prisma.settings.findUnique({ where: { shop } }),
    fetchSitemapUrls(shop),
    fetchAdminUrls(admin, baseUrl),
    checkPasswordProtection(shop),
  ]);

  // Merge: use sitemap URLs, then add any admin URLs not already present
  const allLocs = new Set(sitemapUrls.map((s) => s.loc));
  const merged = [...sitemapUrls];
  for (const entry of adminUrls) {
    if (!allLocs.has(entry.loc)) {
      merged.push(entry);
      allLocs.add(entry.loc);
    }
  }

  return {
    shop,
    storefrontUrl: baseUrl,
    hasApiKey: !!settings?.pagespeedApiKey,
    sitemapUrls: merged,
    isPasswordProtected,
  };
};

async function checkPasswordProtection(shop: string): Promise<boolean> {
  try {
    const res = await fetch(`https://${shop}`, {
      method: "GET",
      headers: { "User-Agent": "SpeedAuditBot/1.0" },
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
    });
    // Shopify redirects to /password with 302 for password-protected stores
    if (res.status === 302) {
      const location = res.headers.get("location") || "";
      return location.includes("/password");
    }
    return res.status === 401;
  } catch {
    return false;
  }
}

async function fetchAdminUrls(
  admin: Awaited<ReturnType<typeof authenticate.admin>>["admin"],
  baseUrl: string,
): Promise<{ loc: string; pageType: string }[]> {
  const results: { loc: string; pageType: string }[] = [];

  try {
    const response = await admin.graphql(`
      {
        pages(first: 50) {
          nodes { handle }
        }
        products(first: 50) {
          nodes { handle }
        }
        collections(first: 50) {
          nodes { handle }
        }
        blogs(first: 10) {
          nodes {
            handle
            articles(first: 50) {
              nodes { handle }
            }
          }
        }
      }
    `);

    const json = await response.json();
    const d = json.data;
    console.log("Admin GraphQL response:", JSON.stringify(json, null, 2));

    if (d?.pages?.nodes) {
      for (const p of d.pages.nodes) {
        results.push({ loc: `${baseUrl}/pages/${p.handle}`, pageType: "page" });
      }
    }
    if (d?.products?.nodes) {
      for (const p of d.products.nodes) {
        results.push({ loc: `${baseUrl}/products/${p.handle}`, pageType: "product" });
      }
    }
    if (d?.collections?.nodes) {
      for (const c of d.collections.nodes) {
        results.push({ loc: `${baseUrl}/collections/${c.handle}`, pageType: "collection" });
      }
    }
    if (d?.blogs?.nodes) {
      for (const b of d.blogs.nodes) {
        results.push({ loc: `${baseUrl}/blogs/${b.handle}`, pageType: "blog" });
        if (b.articles?.nodes) {
          for (const a of b.articles.nodes) {
            results.push({ loc: `${baseUrl}/blogs/${b.handle}/${a.handle}`, pageType: "blog" });
          }
        }
      }
    }
  } catch (err) {
    console.error("Failed to fetch admin URLs:", err);
  }

  return results;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  let url = (formData.get("url") as string)?.trim();
  const pageType = (formData.get("pageType") as string) || "homepage";

  if (!url) {
    url = `https://${session.shop}`;
  }

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }

  // Validate URL belongs to this shop
  try {
    const parsed = new URL(url);
    const shopHost = session.shop.toLowerCase();
    if (parsed.hostname.toLowerCase() !== shopHost) {
      throw new Error("Invalid URL");
    }
  } catch {
    return redirect("/app/audit/new");
  }

  const settings = await prisma.settings.findUnique({
    where: { shop: session.shop },
  });

  const audit = await prisma.audit.create({
    data: {
      shop: session.shop,
      url,
      pageType,
      status: "pending",
    },
  });

  executeAudit(audit.id, settings?.pagespeedApiKey).catch((err) =>
    console.error("Audit execution error:", err)
  );

  return redirect(`/app/audit/${audit.id}`);
};

export default function NewAudit() {
  const { sitemapUrls, storefrontUrl, isPasswordProtected } = useLoaderData<typeof loader>();
  const [mode, setMode] = useState<"select" | "manual">("select");
  const [selectedUrl, setSelectedUrl] = useState(sitemapUrls[0]?.loc ?? storefrontUrl);
  const [manualUrl, setManualUrl] = useState(storefrontUrl);

  // Derive pageType from the selected URL
  const activeUrl = mode === "select" ? selectedUrl : manualUrl;
  const matchedPage = sitemapUrls.find((s) => s.loc === activeUrl);
  const pageType = matchedPage?.pageType ?? guessPageType(activeUrl);

  return (
    <s-page heading="New Performance Audit">
      {isPasswordProtected && (
        <s-banner tone="warning">
          Your store is password-protected. Audit results may be limited because external tools like Google PageSpeed Insights cannot access your pages.
        </s-banner>
      )}
      <s-section heading="Select a page to audit">
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          <s-button
            variant={mode === "select" ? "primary" : "tertiary"}
            onClick={() => setMode("select")}
          >
            Choose from the list
          </s-button>
          <s-button
            variant={mode === "manual" ? "primary" : "tertiary"}
            onClick={() => setMode("manual")}
          >
            Enter URL manually
          </s-button>
        </div>

        <Form method="post">
          {mode === "select" ? (
            <s-select
              label={`Page to audit (${sitemapUrls.length} available)`}
              name="url"
              value={selectedUrl}
              onChange={(e: Event) => {
                const target = e.target as HTMLSelectElement;
                setSelectedUrl(target.value);
              }}
            >
              {sitemapUrls.map((entry) => (
                <s-option key={entry.loc} value={entry.loc}>
                  {formatUrlLabel(entry.loc)} — {entry.pageType}
                </s-option>
              ))}
            </s-select>
          ) : (
            <>
              <s-text-field
                label="URL to audit"
                name="url"
                value={manualUrl}
                onChange={(e: Event) => {
                  const target = e.target as HTMLInputElement;
                  setManualUrl(target.value);
                }}
              />
              <div style={{ marginTop: "4px" }}>
                <s-text color="subdued">
                  Must be a page on {storefrontUrl}
                </s-text>
              </div>
            </>
          )}

          <input type="hidden" name="pageType" value={pageType} />

          <div style={{ marginTop: "16px" }}>
            <s-button variant="primary" type="submit">
              Start Audit
            </s-button>
          </div>
        </Form>
      </s-section>

      <s-section heading="What will be analyzed?">
        <s-unordered-list>
          <s-list-item>
            <s-text type="strong">Performance</s-text> — Core Web Vitals (LCP, CLS, TBT, FCP), Speed Index, resource optimization
          </s-list-item>
          <s-list-item>
            <s-text type="strong">SEO</s-text> — Meta tags, headings, structured data, sitemap, Open Graph
          </s-list-item>
          <s-list-item>
            <s-text type="strong">Accessibility</s-text> — Color contrast, alt text, form labels, viewport, language
          </s-list-item>
          <s-list-item>
            <s-text type="strong">Best Practices</s-text> — HTTPS, security headers, character encoding
          </s-list-item>
          <s-list-item>
            <s-text type="strong">Shopify-specific</s-text> — App scripts, CDN usage, Liquid render time, third-party scripts
          </s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

function formatUrlLabel(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname === "/" ? u.hostname + " (homepage)" : u.pathname;
  } catch {
    return url;
  }
}

function guessPageType(url: string): string {
  try {
    const path = new URL(url).pathname;
    if (path === "/") return "homepage";
    if (path.startsWith("/products/")) return "product";
    if (path.startsWith("/collections/")) return "collection";
    if (path.startsWith("/pages/")) return "page";
    if (path.startsWith("/blogs/")) return "blog";
    if (path.startsWith("/account/")) return "account";
    return "page";
  } catch {
    return "homepage";
  }
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
