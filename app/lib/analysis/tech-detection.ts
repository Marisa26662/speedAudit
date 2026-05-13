export type TechCategory =
  | "cms"
  | "framework"
  | "cdn"
  | "analytics"
  | "css"
  | "server"
  | "ecommerce"
  | "backend";

export interface DetectedTech {
  name: string;
  category: TechCategory;
  confidence: "high" | "medium";
  version?: string;
}

interface Rule {
  test: (html: string, headers: Record<string, string>) => boolean;
  name: string;
  category: TechCategory;
  confidence: "high" | "medium";
  version?: (html: string, headers: Record<string, string>) => string | undefined;
}

function header(headers: Record<string, string>, key: string): string {
  return headers[key.toLowerCase()] ?? "";
}

const RULES: Rule[] = [
  // Frameworks
  {
    test: (html) => html.includes("__NEXT_DATA__") || html.includes("/_next/static/"),
    name: "Next.js",
    category: "framework",
    confidence: "high",
  },
  {
    test: (html) => html.includes("__nuxt__") || html.includes("/_nuxt/"),
    name: "Nuxt.js",
    category: "framework",
    confidence: "high",
  },
  {
    test: (html) => html.includes("data-reactroot") || html.includes("data-reactid"),
    name: "React",
    category: "framework",
    confidence: "high",
  },
  {
    test: (html) => /ng-version=["'][^"']+["']/.test(html),
    name: "Angular",
    category: "framework",
    confidence: "high",
    version: (html) => {
      const m = html.match(/ng-version=["']([^"']+)["']/);
      return m?.[1];
    },
  },
  {
    test: (html) => html.includes("__vue_app__") || /data-v-[a-f0-9]{6,}/.test(html),
    name: "Vue.js",
    category: "framework",
    confidence: "high",
  },
  {
    test: (html) => html.includes("gatsby-runtime") || html.includes("gatsby-ssr"),
    name: "Gatsby",
    category: "framework",
    confidence: "high",
  },
  {
    test: (html) => html.includes("__sveltekit_"),
    name: "SvelteKit",
    category: "framework",
    confidence: "high",
  },
  {
    test: (html) => /<script[^>]+src=["'][^"']*\/_astro\/[^"']*["']/.test(html),
    name: "Astro",
    category: "framework",
    confidence: "high",
  },
  {
    test: (html) =>
      /<script[^>]+src=["'][^"']*\/jquery[^"']*["']/.test(html) ||
      html.includes("/jquery.min.js") ||
      html.includes("/jquery-"),
    name: "jQuery",
    category: "framework",
    confidence: "medium",
  },
  // CMS
  {
    test: (html) =>
      html.includes("wp-content/") ||
      html.includes("wp-includes/") ||
      /<meta[^>]+name=["']generator["'][^>]+content=["']WordPress/.test(html),
    name: "WordPress",
    category: "cms",
    confidence: "high",
  },
  {
    test: (html) => html.includes("cdn.shopify.com") || html.includes("Shopify.shop"),
    name: "Shopify",
    category: "cms",
    confidence: "high",
  },
  {
    test: (html) => html.includes("static.squarespace.com"),
    name: "Squarespace",
    category: "cms",
    confidence: "high",
  },
  {
    test: (html) =>
      html.includes("static.wixstatic.com") || html.includes("parastorage.com"),
    name: "Wix",
    category: "cms",
    confidence: "high",
  },
  {
    test: (html) => html.includes("uploads-ssl.webflow.com"),
    name: "Webflow",
    category: "cms",
    confidence: "high",
  },
  {
    test: (html) => /<meta[^>]+name=["']generator["'][^>]+content=["']Ghost/.test(html),
    name: "Ghost",
    category: "cms",
    confidence: "high",
  },
  {
    test: (html) =>
      /<meta[^>]+name=["']Generator["'][^>]+content=["']Drupal/.test(html),
    name: "Drupal",
    category: "cms",
    confidence: "high",
  },
  {
    test: (html) =>
      /<meta[^>]+name=["']generator["'][^>]+content=["']Joomla/.test(html),
    name: "Joomla",
    category: "cms",
    confidence: "high",
  },
  // E-commerce
  {
    test: (html) =>
      html.includes("woocommerce") && (html.includes("wp-content/") || html.includes("wp-includes/")),
    name: "WooCommerce",
    category: "ecommerce",
    confidence: "high",
  },
  {
    test: (html) => html.includes("static.cdn.shopify.com"),
    name: "Shopify",
    category: "ecommerce",
    confidence: "high",
  },
  // Backend
  {
    test: (_html, headers) => /PHP/i.test(header(headers, "x-powered-by")),
    name: "PHP",
    category: "backend",
    confidence: "high",
    version: (_html, headers) => {
      const m = header(headers, "x-powered-by").match(/PHP\/?([0-9.]+)/i);
      return m?.[1];
    },
  },
  {
    test: (_html, headers) => /Express/i.test(header(headers, "x-powered-by")),
    name: "Node.js",
    category: "backend",
    confidence: "high",
  },
  // Server
  {
    test: (_html, headers) => /^Apache/i.test(header(headers, "server")),
    name: "Apache",
    category: "server",
    confidence: "high",
    version: (_html, headers) => {
      const m = header(headers, "server").match(/Apache\/([0-9.]+)/i);
      return m?.[1];
    },
  },
  {
    test: (_html, headers) => /^nginx/i.test(header(headers, "server")),
    name: "Nginx",
    category: "server",
    confidence: "high",
    version: (_html, headers) => {
      const m = header(headers, "server").match(/nginx\/([0-9.]+)/i);
      return m?.[1];
    },
  },
  {
    test: (_html, headers) => /Microsoft-IIS/i.test(header(headers, "server")),
    name: "IIS",
    category: "server",
    confidence: "high",
    version: (_html, headers) => {
      const m = header(headers, "server").match(/Microsoft-IIS\/([0-9.]+)/i);
      return m?.[1];
    },
  },
  // CDN / Hosting
  {
    test: (_html, headers) =>
      !!header(headers, "cf-ray") || !!header(headers, "cf-cache-status"),
    name: "Cloudflare",
    category: "cdn",
    confidence: "high",
  },
  {
    test: (_html, headers) => !!header(headers, "x-vercel-id"),
    name: "Vercel",
    category: "cdn",
    confidence: "high",
  },
  {
    test: (_html, headers) => !!header(headers, "x-nf-request-id"),
    name: "Netlify",
    category: "cdn",
    confidence: "high",
  },
  {
    test: (_html, headers) =>
      !!header(headers, "x-amz-cf-id") || !!header(headers, "x-amz-cf-pop"),
    name: "AWS CloudFront",
    category: "cdn",
    confidence: "high",
  },
  // Analytics
  {
    test: (html) =>
      html.includes("google-analytics.com") || html.includes("gtag/js"),
    name: "Google Analytics",
    category: "analytics",
    confidence: "high",
  },
  {
    test: (html) => html.includes("googletagmanager.com"),
    name: "Google Tag Manager",
    category: "analytics",
    confidence: "high",
  },
  {
    test: (html) => html.includes("connect.facebook.net/en_US/fbevents"),
    name: "Meta Pixel",
    category: "analytics",
    confidence: "high",
  },
  {
    test: (html) => html.includes("plausible.io/js/"),
    name: "Plausible",
    category: "analytics",
    confidence: "high",
  },
  {
    test: (html) => html.includes("static.hotjar.com"),
    name: "Hotjar",
    category: "analytics",
    confidence: "high",
  },
  {
    test: (html) => html.includes("segment.com/analytics.js"),
    name: "Segment",
    category: "analytics",
    confidence: "high",
  },
  // CSS Frameworks
  {
    test: (html) =>
      html.includes("bootstrap.min.css") || html.includes("bootstrap.bundle"),
    name: "Bootstrap",
    category: "css",
    confidence: "medium",
  },
  // ── Shopify-specific detections ─────────────────────────────────────────────
  {
    test: (html) => /Shopify\.theme\s*=/.test(html),
    name: "Shopify Theme",
    category: "cms",
    confidence: "high",
    version: (html) => {
      const m = html.match(/Shopify\.theme\s*=\s*\{[^}]*"name"\s*:\s*"([^"]+)"/);
      return m?.[1];
    },
  },
  {
    test: (html) => html.includes("shopify-app-embed") || html.includes("app-block"),
    name: "Shopify App Blocks",
    category: "cms",
    confidence: "medium",
  },
];

export function detectTechnologies(
  html: string,
  headers: Record<string, string>,
): DetectedTech[] {
  const results: DetectedTech[] = [];
  const seen = new Set<string>();

  for (const rule of RULES) {
    try {
      if (rule.test(html, headers)) {
        const key = `${rule.name}:${rule.category}`;
        if (!seen.has(key)) {
          seen.add(key);
          const tech: DetectedTech = {
            name: rule.name,
            category: rule.category,
            confidence: rule.confidence,
          };
          if (rule.version) {
            const v = rule.version(html, headers);
            if (v) tech.version = v;
          }
          results.push(tech);
        }
      }
    } catch {
      // ignore individual rule errors
    }
  }

  return results;
}
