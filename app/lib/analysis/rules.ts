import type { StoredPSIData, FetchAnalysisData, RuleResult, RulesData } from "./types";

function auditStatus(score: number | null): "pass" | "warning" | "fail" | "skip" {
  if (score === null) return "skip";
  if (score >= 0.9) return "pass";
  if (score >= 0.5) return "warning";
  return "fail";
}

function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${bytes} B`;
}

function urlFilename(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/");
    return parts[parts.length - 1] || u.hostname;
  } catch {
    return url.slice(0, 60);
  }
}

export function runRules(
  psi: StoredPSIData | null,
  fetch: FetchAnalysisData | null
): RulesData {
  const rules: RuleResult[] = [];

  // ── Performance ────────────────────────────────────────────────────────────

  if (psi) {
    const lcp = psi.metrics.lcp.value;
    rules.push({
      id: "lcp",
      category: "performance",
      title: "Largest Contentful Paint (LCP)",
      description: `LCP measures how long the largest visible element takes to render. Your LCP is ${psi.metrics.lcp.displayValue} (target: under 2.5s).`,
      status: lcp <= 2500 ? "pass" : "fail",
      severity: lcp > 4000 ? "critical" : "warning",
      impact: "high",
      value: psi.metrics.lcp.displayValue,
      recommendation:
        lcp > 2500
          ? "Reduce LCP by addressing the largest content element (usually a hero image or heading)."
          : undefined,
      steps: lcp > 2500 ? [
        "Identify the LCP element using Chrome DevTools (Performance panel > LCP marker)",
        lcp > 4000
          ? "Preload the LCP resource with <link rel=\"preload\"> in your <head>"
          : "Ensure the LCP image uses srcset or a CDN for optimal sizing",
        "Reduce server response time (TTFB) — consider CDN or edge caching",
        "Remove render-blocking CSS/JS that delays first paint",
        "If LCP is a background image, switch to an <img> tag with fetchpriority=\"high\"",
      ] : undefined,
    });

    const cls = psi.metrics.cls.value;
    rules.push({
      id: "cls",
      category: "performance",
      title: "Cumulative Layout Shift (CLS)",
      description: `CLS measures visual stability. Your score is ${psi.metrics.cls.displayValue} (target: under 0.1). ${cls > 0.25 ? "This is a poor score — users experience significant layout jumps." : cls > 0.1 ? "Content is shifting during load, causing a degraded user experience." : "Good visual stability."}`,
      status: cls <= 0.1 ? "pass" : "fail",
      severity: cls > 0.25 ? "critical" : "warning",
      impact: "high",
      value: psi.metrics.cls.displayValue,
      recommendation:
        cls > 0.1
          ? "Prevent layout shifts by reserving space for dynamic content before it loads."
          : undefined,
      steps: cls > 0.1 ? [
        "Add explicit width and height attributes to all <img> and <video> elements",
        "Use CSS aspect-ratio for responsive containers that load dynamic content",
        "Avoid inserting content above existing content (e.g., banners, cookie bars that push content down)",
        "Preload web fonts with <link rel=\"preload\"> and use font-display: swap",
        "Set fixed dimensions on ad slots and embeds before they load",
      ] : undefined,
    });

    const tbt = psi.metrics.tbt.value;
    rules.push({
      id: "tbt",
      category: "performance",
      title: "Total Blocking Time (TBT)",
      description: `TBT measures main thread blocking. Your TBT is ${psi.metrics.tbt.displayValue} (target: under 200ms). ${tbt > 600 ? "The main thread is severely blocked — the page feels unresponsive." : tbt > 200 ? "Noticeable delay in responsiveness to user interactions." : "Good interactivity."}`,
      status: tbt <= 200 ? "pass" : "fail",
      severity: tbt > 600 ? "critical" : "warning",
      impact: "high",
      value: psi.metrics.tbt.displayValue,
      recommendation:
        tbt > 200
          ? "Reduce JavaScript execution time to make the page interactive faster."
          : undefined,
      steps: tbt > 200 ? [
        "Break up long JavaScript tasks (> 50ms) into smaller chunks using requestIdleCallback or setTimeout",
        "Defer non-critical third-party scripts (analytics, chat widgets) until after page load",
        "Use dynamic import() for code that isn't needed on initial render",
        "Audit third-party scripts — each one adds to TBT; remove unused trackers/widgets",
        tbt > 600 ? "Consider moving heavy computation to Web Workers" : "Profile with Chrome DevTools Performance tab to find the longest tasks",
      ] : undefined,
    });

    const ttfb = psi.metrics.ttfb.value;
    rules.push({
      id: "ttfb",
      category: "performance",
      title: "Server Response Time (TTFB)",
      description: `TTFB is ${psi.metrics.ttfb.displayValue} (target: under 800ms). ${ttfb > 1800 ? "Extremely slow server response — everything downstream is delayed." : ttfb > 800 ? "Server is taking too long to respond." : "Good server response time."}`,
      status: ttfb <= 800 ? "pass" : "fail",
      severity: ttfb > 1800 ? "critical" : "warning",
      impact: "medium",
      value: psi.metrics.ttfb.displayValue,
      recommendation:
        ttfb > 800
          ? "Improve server response time to speed up initial page delivery."
          : undefined,
      steps: ttfb > 800 ? [
        "Deploy a CDN (Cloudflare, Vercel Edge, AWS CloudFront) to serve content from nearby edge nodes",
        "Enable server-side caching (Redis, Memcached) for database queries and API responses",
        "Optimize database queries — add indexes, reduce N+1 queries",
        ttfb > 1800 ? "Consider upgrading your hosting plan or switching to a faster provider" : "Use static generation (SSG) or ISR for pages that don't change frequently",
        "Enable HTTP/2 or HTTP/3 on your server for faster connection setup",
      ] : undefined,
    });

    const fcp = psi.metrics.fcp.value;
    rules.push({
      id: "fcp",
      category: "performance",
      title: "First Contentful Paint (FCP)",
      description: `FCP is ${psi.metrics.fcp.displayValue} (target: under 1.8s). This is when users first see any content on screen.`,
      status: fcp <= 1800 ? "pass" : "fail",
      severity: fcp > 3000 ? "critical" : "warning",
      impact: "high",
      value: psi.metrics.fcp.displayValue,
      recommendation:
        fcp > 1800
          ? "Speed up first paint by reducing render-blocking resources and server response time."
          : undefined,
      steps: fcp > 1800 ? [
        "Inline critical CSS (above-the-fold styles) directly in the HTML <head>",
        "Defer non-critical JavaScript with async or defer attributes",
        "Reduce TTFB by implementing server-side caching or a CDN",
        "Minimize the HTML document size — remove unnecessary comments, whitespace",
        "Preconnect to required origins: <link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">",
      ] : undefined,
    });

    const si = psi.metrics.si.value;
    rules.push({
      id: "speed-index",
      category: "performance",
      title: "Speed Index",
      description: `Speed Index is ${psi.metrics.si.displayValue} (target: under 3.4s). It measures how quickly the visible area of the page is populated.`,
      status: si <= 3400 ? "pass" : "fail",
      severity: si > 5800 ? "critical" : "warning",
      impact: "medium",
      value: psi.metrics.si.displayValue,
      recommendation:
        si > 3400
          ? "Improve perceived loading speed by prioritizing visible content."
          : undefined,
      steps: si > 3400 ? [
        "Minimize render-blocking resources to let the browser paint content earlier",
        "Use font-display: swap for web fonts to avoid invisible text during load",
        "Prioritize above-the-fold content — lazy load everything below the fold",
        "Optimize critical rendering path: inline critical CSS, defer JS",
      ] : undefined,
    });

    // Render-blocking resources
    const rb = psi.audits.renderBlocking;
    const rbStatus = auditStatus(rb.score);
    if (rbStatus !== "skip") {
      const savingsInfo = [
        rb.savingsMs ? `${formatMs(rb.savingsMs)} potential savings` : null,
        rb.itemCount ? `${rb.itemCount} resource${rb.itemCount > 1 ? "s" : ""}` : null,
      ].filter(Boolean).join(" · ");

      rules.push({
        id: "render-blocking",
        category: "performance",
        title: "Render-blocking resources",
        description: `${rb.itemCount ?? 0} resources are blocking the first paint of your page.${rb.savingsMs ? ` Eliminating them could save ${formatMs(rb.savingsMs)}.` : ""}`,
        status: rbStatus === "pass" ? "pass" : "fail",
        severity: (rb.savingsMs ?? 0) > 1000 ? "critical" : "warning",
        impact: "high",
        value: savingsInfo || undefined,
        resources: rb.items,
        recommendation:
          rbStatus !== "pass"
            ? "Eliminate render-blocking resources to speed up first paint."
            : undefined,
        steps: rbStatus !== "pass" ? [
          "Move non-critical CSS to a separate file and load it asynchronously with media=\"print\" onload=\"this.media='all'\"",
          "Add defer or async attribute to <script> tags that don't need to run before render",
          "Inline critical above-the-fold CSS directly in the <head> to avoid the extra network request",
          "Use <link rel=\"preload\"> for fonts and critical resources",
        ] : undefined,
      });
    }

    // Unused JavaScript
    const unusedJs = psi.audits.unusedJs;
    if (unusedJs.score !== null && unusedJs.score < 0.9) {
      const topFiles = unusedJs.items?.slice(0, 5).map(
        (i) => `${urlFilename(i.url ?? "")} (${i.wastedBytes ? formatBytes(i.wastedBytes) : "–"} unused)`
      ).join(", ");

      rules.push({
        id: "unused-javascript",
        category: "performance",
        title: "Unused JavaScript",
        description: `${unusedJs.savingsBytes ? formatBytes(unusedJs.savingsBytes) : "Significant bytes"} of JavaScript is loaded but never executed. ${unusedJs.itemCount ? `Found in ${unusedJs.itemCount} file${unusedJs.itemCount > 1 ? "s" : ""}.` : ""}`,
        status: "fail",
        severity: (unusedJs.savingsBytes ?? 0) > 150_000 ? "critical" : "warning",
        impact: "high",
        value: unusedJs.savingsBytes ? formatBytes(unusedJs.savingsBytes) + " saveable" : undefined,
        resources: unusedJs.items,
        recommendation: topFiles
          ? `Top offenders: ${topFiles}`
          : "Identify and remove unused JavaScript bundles.",
        steps: [
          "Use Chrome DevTools Coverage tab to identify exactly which code is unused",
          "Implement code splitting with dynamic import() — only load code when the user needs it",
          "Audit your npm dependencies: run 'npx depcheck' to find unused packages",
          "Replace large libraries with smaller alternatives (e.g., date-fns instead of moment.js)",
          "Enable tree-shaking in your bundler (webpack/Vite/esbuild) — use ES module imports",
          unusedJs.itemCount && unusedJs.itemCount > 3
            ? "Consider lazy-loading third-party scripts (analytics, chat) with requestIdleCallback"
            : "Review if any A/B testing or feature flag scripts are still needed",
        ],
      });
    }

    // Unused CSS
    const unusedCss = psi.audits.unusedCss;
    if (unusedCss.score !== null && unusedCss.score < 0.9) {
      rules.push({
        id: "unused-css",
        category: "performance",
        title: "Unused CSS",
        description: `${unusedCss.savingsBytes ? formatBytes(unusedCss.savingsBytes) : "Significant bytes"} of CSS rules are loaded but never applied to this page.${unusedCss.itemCount ? ` Found in ${unusedCss.itemCount} stylesheet${unusedCss.itemCount > 1 ? "s" : ""}.` : ""}`,
        status: "fail",
        severity: (unusedCss.savingsBytes ?? 0) > 100_000 ? "critical" : "warning",
        impact: "medium",
        value: unusedCss.savingsBytes ? formatBytes(unusedCss.savingsBytes) + " saveable" : undefined,
        resources: unusedCss.items,
        recommendation: "Remove unused CSS to reduce page weight and parsing time.",
        steps: [
          "Use Chrome DevTools Coverage tab to see which CSS rules are unused on this page",
          "Use PurgeCSS or UnCSS in your build pipeline to automatically strip unused styles",
          "If using Tailwind CSS, ensure the content paths in tailwind.config.js cover all templates",
          "Split CSS into critical (above-the-fold) and non-critical; load non-critical CSS asynchronously",
          "Remove CSS from unused components, old feature flags, or deprecated pages",
        ],
      });
    }

    // Image optimization
    const imgOpt = psi.audits.imageOptimization;
    if (imgOpt.score !== null && imgOpt.score < 0.9) {
      rules.push({
        id: "image-optimization",
        category: "performance",
        title: "Unoptimized images",
        description: `${imgOpt.savingsBytes ? formatBytes(imgOpt.savingsBytes) : "Significant bytes"} can be saved by properly compressing images.${imgOpt.itemCount ? ` ${imgOpt.itemCount} image${imgOpt.itemCount > 1 ? "s" : ""} can be optimized.` : ""}`,
        status: "fail",
        severity: imgOpt.score < 0.5 ? "critical" : "warning",
        impact: "high",
        value: imgOpt.savingsBytes ? formatBytes(imgOpt.savingsBytes) + " saveable" : undefined,
        resources: imgOpt.items,
        recommendation: "Compress and properly size images to reduce page weight.",
        steps: [
          "Use modern formats: WebP (30% smaller than JPEG) or AVIF (50% smaller)",
          "Resize images to their display dimensions — don't serve a 4000px image in a 400px container",
          "Use Shopify's built-in image CDN with the image_url filter for automatic resizing",
          "Set quality to 80-85% for JPEG/WebP — visually identical but significantly smaller",
          "Add width and height attributes to prevent layout shifts while images load",
        ],
      });
    }

    // WebP images
    const webp = psi.audits.webpImages;
    if (webp.score !== null && webp.score < 0.9) {
      rules.push({
        id: "webp-images",
        category: "performance",
        title: "Images not using modern formats",
        description: `${webp.savingsBytes ? formatBytes(webp.savingsBytes) : "Significant data"} can be saved by converting to WebP or AVIF.${webp.itemCount ? ` ${webp.itemCount} image${webp.itemCount > 1 ? "s" : ""} still use legacy formats.` : ""}`,
        status: "fail",
        severity: "warning",
        impact: "medium",
        value: webp.savingsBytes ? formatBytes(webp.savingsBytes) + " saveable" : undefined,
        resources: webp.items,
        recommendation: "Switch from JPEG/PNG to WebP or AVIF for better compression.",
        steps: [
          "Use <picture> element with WebP source and JPEG/PNG fallback for browser compatibility",
          "Shopify CDN auto-converts images to WebP — ensure you're using image_url Liquid filter",
          "For custom uploaded images, convert to WebP before uploading",
        ],
      });
    }

    // Responsive images
    const respImg = psi.audits.responsiveImages;
    if (respImg.score !== null && respImg.score < 0.9) {
      rules.push({
        id: "responsive-images",
        category: "performance",
        title: "Improperly sized images",
        description: `${respImg.savingsBytes ? formatBytes(respImg.savingsBytes) : "Data"} wasted by serving images larger than their display size.${respImg.itemCount ? ` ${respImg.itemCount} image${respImg.itemCount > 1 ? "s are" : " is"} oversized.` : ""}`,
        status: "fail",
        severity: (respImg.savingsBytes ?? 0) > 200_000 ? "critical" : "warning",
        impact: "medium",
        value: respImg.savingsBytes ? formatBytes(respImg.savingsBytes) + " saveable" : undefined,
        resources: respImg.items,
        recommendation: "Serve images at the correct dimensions for the user's screen.",
        steps: [
          "Use srcset attribute to provide multiple image sizes for different viewport widths",
          "Add sizes attribute to tell the browser which size to download before layout",
          "Use Shopify's image_url filter with width parameter for automatic resizing",
          "For CSS background images, use media queries to load appropriate sizes",
        ],
      });
    }

    // Offscreen images
    const offscreen = psi.audits.offscreenImages;
    if (offscreen.score !== null && offscreen.score < 0.9) {
      rules.push({
        id: "offscreen-images",
        category: "performance",
        title: "Offscreen images not deferred",
        description: `${offscreen.savingsBytes ? formatBytes(offscreen.savingsBytes) : "Data"} loaded for images not visible on the initial screen.${offscreen.itemCount ? ` ${offscreen.itemCount} image${offscreen.itemCount > 1 ? "s" : ""} below the fold.` : ""}`,
        status: "fail",
        severity: "warning",
        impact: "medium",
        value: offscreen.savingsBytes ? formatBytes(offscreen.savingsBytes) + " saveable" : undefined,
        resources: offscreen.items,
        recommendation: "Lazy-load images that are below the fold.",
        steps: [
          "Add loading=\"lazy\" to all <img> tags below the fold (native browser lazy loading)",
          "Keep loading=\"eager\" on above-the-fold images (LCP candidates)",
          "In Shopify Liquid templates, add loading='lazy' to image tags in product grids and collection pages",
          "Use Intersection Observer API for custom lazy loading of background images",
        ],
      });
    }

    // Deprecations
    const deprecations = psi.audits.deprecations;
    if (deprecations.score !== null && deprecations.score < 0.9) {
      rules.push({
        id: "deprecations",
        category: "best-practices",
        title: "Uses deprecated APIs",
        description: `${deprecations.itemCount ? `${deprecations.itemCount} deprecated API${deprecations.itemCount > 1 ? "s" : ""} detected` : "Deprecated APIs detected"}. These may stop working in future browser versions.`,
        status: "fail",
        severity: "warning",
        impact: "medium",
        resources: deprecations.items,
        recommendation: "Replace deprecated APIs with modern alternatives before browsers remove support.",
        steps: [
          "Check Chrome DevTools Console for deprecation warnings with replacement suggestions",
          "Update third-party libraries that use deprecated APIs to their latest versions",
          "Replace document.write() with DOM manipulation (createElement, appendChild)",
          "Replace synchronous XMLHttpRequest with fetch() API",
        ],
      });
    }

    // Color contrast
    const contrast = psi.audits.colorContrast;
    const contrastStatus = auditStatus(contrast.score);
    if (contrastStatus !== "skip") {
      rules.push({
        id: "color-contrast",
        category: "accessibility",
        title: "Color contrast",
        description: `${contrastStatus === "pass" ? "All text has sufficient contrast." : `${contrast.itemCount ?? 0} element${(contrast.itemCount ?? 0) > 1 ? "s have" : " has"} insufficient contrast ratio, making text hard to read for users with low vision.`}`,
        status: contrastStatus === "pass" ? "pass" : "fail",
        severity: contrastStatus === "fail" ? "critical" : "warning",
        impact: "high",
        resources: contrast.items,
        recommendation:
          contrastStatus !== "pass"
            ? "Fix color contrast to meet WCAG AA minimum ratios."
            : undefined,
        steps: contrastStatus !== "pass" ? [
          "Normal text (< 18px): minimum contrast ratio 4.5:1 against background",
          "Large text (>= 18px bold or >= 24px): minimum contrast ratio 3:1",
          "Use WebAIM Contrast Checker (webaim.org/resources/contrastchecker) to test colors",
          "Avoid light gray text on white — use #595959 or darker for body text on white backgrounds",
          "In Shopify theme editor, adjust color settings in Theme Settings > Colors",
        ] : undefined,
      });
    }

    // Button names
    const btn = psi.audits.buttonName;
    const btnStatus = auditStatus(btn.score);
    if (btnStatus !== "skip" && btnStatus !== "pass") {
      rules.push({
        id: "button-names",
        category: "accessibility",
        title: "Buttons missing accessible names",
        description: `${btn.itemCount ?? 0} button${(btn.itemCount ?? 0) > 1 ? "s lack" : " lacks"} an accessible name. Screen reader users cannot determine what these buttons do.`,
        status: "fail",
        severity: "warning",
        impact: "medium",
        resources: btn.items,
        recommendation: "Ensure every interactive button has a descriptive accessible name.",
        steps: [
          "Add visible text content inside <button> elements",
          "For icon-only buttons, add aria-label=\"descriptive action\" (e.g., aria-label=\"Close menu\")",
          "Never use generic labels like \"Click here\" — describe the action (\"Submit form\", \"Delete item\")",
          "Test with a screen reader (VoiceOver, NVDA) to verify button announcements",
        ],
      });
    }

    // Form labels
    const formLabels = psi.audits.formLabels;
    const flStatus = auditStatus(formLabels.score);
    if (flStatus !== "skip" && flStatus !== "pass") {
      rules.push({
        id: "form-labels",
        category: "accessibility",
        title: "Form inputs missing labels",
        description: `${formLabels.itemCount ?? 0} form input${(formLabels.itemCount ?? 0) > 1 ? "s" : ""} without an associated label. Users relying on assistive technology cannot identify these fields.`,
        status: "fail",
        severity: "critical",
        impact: "high",
        resources: formLabels.items,
        recommendation: "Associate every form input with a visible <label> element.",
        steps: [
          "Wrap each input with a <label> element, or use the for=\"input-id\" attribute to link them",
          "Ensure placeholder text is NOT used as the only label — it disappears on focus",
          "For custom inputs, use aria-label or aria-labelledby",
          "Group related inputs with <fieldset> and <legend> (e.g., radio buttons, address fields)",
        ],
      });
    }

    // Tap targets
    const tap = psi.audits.tapTargets;
    const tapStatus = auditStatus(tap.score);
    if (tapStatus !== "skip" && tapStatus !== "pass") {
      rules.push({
        id: "tap-targets",
        category: "accessibility",
        title: "Tap targets too small",
        description: `${tap.itemCount ?? 0} interactive element${(tap.itemCount ?? 0) > 1 ? "s are" : " is"} smaller than the recommended 48x48px minimum, making them difficult to tap on mobile.`,
        status: "fail",
        severity: "warning",
        impact: "medium",
        resources: tap.items,
        recommendation: "Make all interactive elements at least 48x48 pixels with 8px spacing.",
        steps: [
          "Set min-height: 48px and min-width: 48px on buttons and links (or use padding to achieve this)",
          "Add at least 8px margin between adjacent tap targets to prevent accidental taps",
          "For inline links in text, increase line-height to at least 1.5 for adequate vertical spacing",
          "Test on a real mobile device — simulator touch targets feel different than actual fingers",
        ],
      });
    }

    // Link text
    const linkText = psi.audits.linkText;
    const ltStatus = auditStatus(linkText.score);
    if (ltStatus !== "skip" && ltStatus !== "pass") {
      rules.push({
        id: "link-text",
        category: "seo",
        title: "Links lack descriptive text",
        description: "Links with generic text like \"click here\" or \"read more\" provide no context to search engines or screen reader users about the destination.",
        status: "fail",
        severity: "warning",
        impact: "medium",
        resources: linkText.items,
        recommendation: "Use descriptive link text that explains where the link goes.",
        steps: [
          "Replace \"click here\" with descriptive text (e.g., \"view our pricing plans\" instead of \"click here\")",
          "Each link should make sense out of context — screen readers can navigate by links alone",
          "Include relevant keywords in anchor text for SEO value",
          "Avoid using the same link text for different destinations on the same page",
        ],
      });
    }
  }

  // ── SEO ────────────────────────────────────────────────────────────────────

  if (fetch) {
    if (!fetch.title) {
      rules.push({
        id: "missing-title",
        category: "seo",
        title: "Missing page title",
        description: "The <title> tag is missing. This is the most important on-page SEO element — it appears in search results and browser tabs.",
        status: "fail",
        severity: "critical",
        impact: "high",
        recommendation: "Add a unique, descriptive <title> tag to every page.",
        steps: [
          "Add <title>Your Primary Keyword — Brand Name</title> inside your <head>",
          "Keep it between 30-60 characters to avoid truncation in search results",
          "Include your primary keyword near the beginning of the title",
          "In Shopify, edit the title in the SEO section of each page/product editor",
        ],
      });
    } else if (fetch.titleLength > 60) {
      rules.push({
        id: "title-too-long",
        category: "seo",
        title: "Title tag too long",
        description: `Your title is ${fetch.titleLength} characters. Google typically displays 50-60 characters in search results — the rest gets truncated with "...".`,
        status: "fail",
        severity: "warning",
        impact: "medium",
        value: `${fetch.titleLength} chars`,
        recommendation: `Current title: "${fetch.title?.slice(0, 65)}${fetch.titleLength > 65 ? "..." : ""}"`,
        steps: [
          `Shorten to under 60 characters. Current: ${fetch.titleLength} chars`,
          "Front-load your most important keywords — they might get cut off",
          "Consider format: Primary Keyword — Secondary Keyword | Brand",
        ],
      });
    } else if (fetch.titleLength < 30) {
      rules.push({
        id: "title-too-short",
        category: "seo",
        title: "Title tag too short",
        description: `Your title is only ${fetch.titleLength} characters. You're missing an opportunity to include relevant keywords and attract clicks.`,
        status: "fail",
        severity: "warning",
        impact: "low",
        value: `${fetch.titleLength} chars`,
        recommendation: `Current title: "${fetch.title}"`,
        steps: [
          "Expand to 30-60 characters with relevant keywords",
          "Include your brand name (e.g., \" | Your Brand\")",
          "Add a value proposition or differentiator",
        ],
      });
    } else {
      rules.push({
        id: "title-ok",
        category: "seo",
        title: "Page title",
        description: `Well-sized title: "${fetch.title}" (${fetch.titleLength} chars).`,
        status: "pass",
        severity: "info",
        impact: "high",
        value: `${fetch.titleLength} chars`,
      });
    }

    if (!fetch.metaDescription) {
      rules.push({
        id: "missing-meta-description",
        category: "seo",
        title: "Missing meta description",
        description: "No meta description found. Search engines may auto-generate one from page content, which often produces poor results that reduce click-through rates.",
        status: "fail",
        severity: "critical",
        impact: "high",
        recommendation: "Add a compelling meta description that drives clicks from search results.",
        steps: [
          "Add <meta name=\"description\" content=\"...\"> in your <head> tag",
          "Write 120-160 characters that summarize the page and include a call-to-action",
          "In Shopify, edit the meta description in the SEO section of each page/product editor",
          "Make it unique per page — don't duplicate across your site",
        ],
      });
    } else if (fetch.metaDescriptionLength > 160) {
      rules.push({
        id: "meta-description-too-long",
        category: "seo",
        title: "Meta description too long",
        description: `Your description is ${fetch.metaDescriptionLength} characters — Google truncates at ~155-160 characters.`,
        status: "fail",
        severity: "warning",
        impact: "medium",
        value: `${fetch.metaDescriptionLength} chars`,
        recommendation: "Trim to under 160 characters while keeping the core message.",
        steps: [
          `Shorten from ${fetch.metaDescriptionLength} to under 160 characters`,
          "Put the most important information and CTA in the first 120 characters",
        ],
      });
    } else if (fetch.metaDescriptionLength < 70) {
      rules.push({
        id: "meta-description-too-short",
        category: "seo",
        title: "Meta description too short",
        description: `Your description is only ${fetch.metaDescriptionLength} characters. You have room for 160 characters — use it to sell the click.`,
        status: "fail",
        severity: "info",
        impact: "low",
        value: `${fetch.metaDescriptionLength} chars`,
        recommendation: "Expand your meta description to 120-160 characters.",
        steps: [
          "Add more detail about what the page offers",
          "Include a clear call-to-action",
          "Include secondary keywords naturally",
        ],
      });
    } else {
      rules.push({
        id: "meta-description-ok",
        category: "seo",
        title: "Meta description",
        description: `Good length: ${fetch.metaDescriptionLength} characters.`,
        status: "pass",
        severity: "info",
        impact: "high",
        value: `${fetch.metaDescriptionLength} chars`,
      });
    }

    if (fetch.h1s.length === 0) {
      rules.push({
        id: "missing-h1",
        category: "seo",
        title: "Missing H1 heading",
        description: "No H1 tag found. The H1 is the primary heading that tells both users and search engines what this page is about.",
        status: "fail",
        severity: "critical",
        impact: "high",
        recommendation: "Add exactly one H1 tag with your primary keyword.",
        steps: [
          "Add a single <h1> tag that clearly describes the page topic",
          "Include your primary keyword naturally in the H1 text",
          "In Shopify themes, the product/collection title is usually the H1 — verify in your theme code",
          "Ensure subsequent headings follow hierarchy: H2, H3, etc.",
        ],
      });
    } else if (fetch.h1s.length > 1) {
      rules.push({
        id: "multiple-h1",
        category: "seo",
        title: "Multiple H1 headings",
        description: `Found ${fetch.h1s.length} H1 tags. Having multiple H1s dilutes the primary keyword signal.`,
        status: "fail",
        severity: "warning",
        impact: "medium",
        value: `${fetch.h1s.length} H1 tags: "${fetch.h1s.slice(0, 3).map(h => h.slice(0, 40)).join('", "')}"`,
        recommendation: "Use only one H1 per page. Convert additional H1s to H2 or H3.",
        steps: [
          "Keep the most relevant H1 and change others to H2 or H3",
          "Ensure a logical heading hierarchy (H1 > H2 > H3)",
          "In Shopify, check your theme's section files for duplicate H1 tags",
        ],
      });
    } else {
      rules.push({
        id: "h1-ok",
        category: "seo",
        title: "H1 heading",
        description: `The page has exactly one H1: "${fetch.h1s[0]?.slice(0, 60)}"`,
        status: "pass",
        severity: "info",
        impact: "high",
      });
    }

    if (fetch.h1s.length > 0 && fetch.h2s.length === 0 && fetch.wordCount > 300) {
      rules.push({
        id: "no-h2-headings",
        category: "seo",
        title: "No H2 subheadings",
        description: `The page has ${fetch.wordCount} words but no H2 subheadings. Subheadings improve readability and help search engines understand content structure.`,
        status: "fail",
        severity: "info",
        impact: "low",
        recommendation: "Break content into sections with descriptive H2 headings.",
        steps: [
          "Add H2 headings every 200-300 words to break up content",
          "Include secondary keywords in H2 text naturally",
          "Use headings to create a scannable outline of your content",
        ],
      });
    }

    if (!fetch.canonicalUrl) {
      rules.push({
        id: "missing-canonical",
        category: "seo",
        title: "Missing canonical URL",
        description: "No canonical URL specified. Without it, search engines may index duplicate versions of this page.",
        status: "fail",
        severity: "warning",
        impact: "medium",
        recommendation: "Add a self-referencing canonical tag to prevent duplicate content issues.",
        steps: [
          `Add <link rel="canonical" href="${fetch.finalUrl}"> in your <head>`,
          "Shopify automatically adds canonical tags — verify your theme hasn't overridden this",
          "Ensure the canonical URL matches the preferred version of the page",
        ],
      });
    } else {
      rules.push({
        id: "canonical-ok",
        category: "seo",
        title: "Canonical URL",
        description: `Canonical URL: ${fetch.canonicalUrl}`,
        status: "pass",
        severity: "info",
        impact: "medium",
      });
    }

    rules.push({
      id: "robots-txt",
      category: "seo",
      title: "robots.txt",
      description: fetch.hasRobotsTxt
        ? "A robots.txt file exists and guides search engine crawlers."
        : "No robots.txt file found. Search engines won't know which pages to skip.",
      status: fetch.hasRobotsTxt ? "pass" : "fail",
      severity: "warning",
      impact: "medium",
      recommendation: !fetch.hasRobotsTxt
        ? "Shopify generates robots.txt automatically. Check if it's accessible at your store URL + /robots.txt"
        : undefined,
    });

    rules.push({
      id: "sitemap",
      category: "seo",
      title: "XML sitemap",
      description: fetch.hasSitemap
        ? `Sitemap found${fetch.sitemapUrl ? ` at ${fetch.sitemapUrl}` : ""}.`
        : "No XML sitemap found. Search engines discover pages through sitemaps.",
      status: fetch.hasSitemap ? "pass" : "fail",
      severity: "warning",
      impact: "medium",
      recommendation: !fetch.hasSitemap
        ? "Shopify generates a sitemap at /sitemap.xml. Verify it's accessible and submit to Google Search Console."
        : undefined,
    });

    if (fetch.imagesMissingAlt > 0) {
      const percentage = Math.round((fetch.imagesMissingAlt / Math.max(fetch.imagesTotal, 1)) * 100);
      rules.push({
        id: "images-missing-alt",
        category: "seo",
        title: "Images missing alt text",
        description: `${fetch.imagesMissingAlt} of ${fetch.imagesTotal} images (${percentage}%) lack alt text.`,
        status: "fail",
        severity: fetch.imagesMissingAlt > 5 ? "critical" : "warning",
        impact: "medium",
        value: `${fetch.imagesMissingAlt} of ${fetch.imagesTotal} images`,
        recommendation: "Add descriptive alt text to all meaningful images.",
        steps: [
          "In Shopify, edit image alt text in the product/collection image settings",
          "For decorative images, use alt=\"\" (empty alt)",
          "Describe what the image shows, not what it is",
          "Keep alt text under 125 characters for screen reader compatibility",
        ],
      });
    } else if (fetch.imagesTotal > 0) {
      rules.push({
        id: "images-alt-ok",
        category: "seo",
        title: "Image alt text",
        description: `All ${fetch.imagesTotal} images have alt text.`,
        status: "pass",
        severity: "info",
        impact: "medium",
      });
    }

    rules.push({
      id: "structured-data",
      category: "seo",
      title: "Structured data (Schema.org)",
      description: fetch.hasStructuredData
        ? `Found structured data: ${fetch.structuredDataTypes.join(", ")}. This enables rich results in Google.`
        : "No structured data found. You're missing out on rich results in Google (star ratings, product info, breadcrumbs).",
      status: fetch.hasStructuredData ? "pass" : "fail",
      severity: "info",
      impact: "medium",
      value: fetch.structuredDataTypes.length > 0 ? fetch.structuredDataTypes.join(", ") : undefined,
      recommendation: !fetch.hasStructuredData
        ? "Add JSON-LD structured data. Shopify themes usually include Product schema — verify it's present."
        : undefined,
    });

    const hasOG = !!(fetch.openGraph.title && fetch.openGraph.description);
    const hasOGImage = !!fetch.openGraph.image;
    rules.push({
      id: "open-graph",
      category: "seo",
      title: "Open Graph tags",
      description: hasOG
        ? `OG tags present: title, description${hasOGImage ? ", image" : " (missing image)"}.`
        : "Missing Open Graph tags. Social media shares will show a generic preview.",
      status: hasOG ? "pass" : "fail",
      severity: "warning",
      impact: "low",
      recommendation: !hasOG
        ? "Add Open Graph meta tags for professional social media previews."
        : !hasOGImage
        ? "Add an og:image tag — posts with images get 2-3x more engagement."
        : undefined,
    });

    if (!fetch.hasTwitterCard && !hasOG) {
      rules.push({
        id: "twitter-card",
        category: "seo",
        title: "Missing Twitter Card tags",
        description: "No Twitter Card meta tags found. Tweets linking to your page will show a plain text link.",
        status: "fail",
        severity: "info",
        impact: "low",
        recommendation: "Add Twitter Card meta tags for rich Twitter/X previews.",
      });
    }

    if (fetch.wordCount < 100 && fetch.wordCount > 0) {
      rules.push({
        id: "thin-content",
        category: "seo",
        title: "Thin content",
        description: `Only ${fetch.wordCount} words found. Pages with very little content are unlikely to rank well.`,
        status: "fail",
        severity: "warning",
        impact: "medium",
        value: `${fetch.wordCount} words`,
        recommendation: "Add more substantive content to this page.",
        steps: [
          "Aim for at least 300-500 words for standard pages",
          "For product pages, add detailed descriptions, specs, and FAQs",
          "For collection pages, add an introduction paragraph with relevant keywords",
        ],
      });
    }

    if (fetch.internalLinks < 3) {
      rules.push({
        id: "few-internal-links",
        category: "seo",
        title: "Low internal link count",
        description: `Only ${fetch.internalLinks} internal links found. Internal linking helps search engines discover pages.`,
        status: "fail",
        severity: "info",
        impact: "low",
        value: `${fetch.internalLinks} internal links`,
        recommendation: "Add more internal links to help both users and search engines navigate your site.",
      });
    }

    if (!fetch.isIndexable) {
      rules.push({
        id: "not-indexable",
        category: "seo",
        title: "Page is not indexable",
        description: `This page has a ${fetch.robotsMeta ?? "noindex"} directive. Search engines will NOT index this page.`,
        status: "fail",
        severity: "critical",
        impact: "high",
        value: fetch.robotsMeta ?? "noindex",
        recommendation: "If this page should appear in search results, remove the noindex directive.",
      });
    }

    if (!fetch.lang) {
      rules.push({
        id: "missing-lang",
        category: "seo",
        title: "Missing HTML lang attribute",
        description: "No lang attribute on the <html> tag. This helps search engines understand the content language.",
        status: "fail",
        severity: "warning",
        impact: "medium",
        recommendation: "Add a lang attribute to your <html> tag.",
      });
    }
  }

  // ── Accessibility ──────────────────────────────────────────────────────────

  if (fetch) {
    rules.push({
      id: "html-lang",
      category: "accessibility",
      title: "HTML lang attribute",
      description: fetch.lang
        ? `The page declares language: "${fetch.lang}". Screen readers use this for correct pronunciation.`
        : "Missing lang attribute. Screen readers won't know what language to use.",
      status: fetch.lang ? "pass" : "fail",
      severity: "critical",
      impact: "high",
    });

    rules.push({
      id: "viewport-meta",
      category: "accessibility",
      title: "Viewport meta tag",
      description: fetch.hasViewportMeta
        ? "Viewport meta tag is correctly configured for responsive design."
        : "Missing viewport meta tag. The page won't render properly on mobile devices.",
      status: fetch.hasViewportMeta ? "pass" : "fail",
      severity: "critical",
      impact: "high",
    });

    if (fetch.imagesMissingAlt > 0) {
      rules.push({
        id: "image-alt-a11y",
        category: "accessibility",
        title: "Images without alt text",
        description: `${fetch.imagesMissingAlt} images have no alt text. Screen reader users won't know what they show.`,
        status: "fail",
        severity: fetch.imagesMissingAlt > 3 ? "critical" : "warning",
        impact: "high",
        value: `${fetch.imagesMissingAlt} images`,
        recommendation: "Provide descriptive alt text for all informative images.",
        steps: [
          "Informative images: describe the content (\"Chart showing 40% growth in Q4\")",
          "Decorative images: use alt=\"\" (empty string, not missing attribute)",
          "In Shopify, add alt text via the product image settings in admin",
          "This is WCAG 2.1 Level A — a fundamental accessibility requirement",
        ],
      });
    }
  }

  // ── Best Practices ─────────────────────────────────────────────────────────

  if (fetch) {
    rules.push({
      id: "https",
      category: "best-practices",
      title: "HTTPS",
      description: fetch.isHttps
        ? "The site uses HTTPS encryption. User data is protected in transit."
        : "This site does NOT use HTTPS. User data is transmitted in plain text.",
      status: fetch.isHttps ? "pass" : "fail",
      severity: "critical",
      impact: "high",
      recommendation: !fetch.isHttps
        ? "Shopify stores use HTTPS by default. Verify your custom domain DNS settings."
        : undefined,
    });

    const sh = fetch.securityHeaders;

    if (!sh.contentSecurityPolicy) {
      rules.push({
        id: "csp",
        category: "best-practices",
        title: "Missing Content-Security-Policy header",
        description: "No CSP header found. Without it, your site is more vulnerable to XSS attacks.",
        status: "fail",
        severity: "warning",
        impact: "high",
        recommendation: "Add a Content-Security-Policy header to prevent XSS attacks.",
      });
    }

    if (!sh.xContentTypeOptions) {
      rules.push({
        id: "x-content-type-options",
        category: "best-practices",
        title: "Missing X-Content-Type-Options header",
        description: "Without this header, browsers may MIME-sniff responses, potentially executing files as JavaScript.",
        status: "fail",
        severity: "warning",
        impact: "medium",
        recommendation: "Add: X-Content-Type-Options: nosniff",
      });
    }

    if (!sh.xFrameOptions) {
      rules.push({
        id: "x-frame-options",
        category: "best-practices",
        title: "Missing X-Frame-Options header",
        description: "Your site can be embedded in iframes on other domains, enabling clickjacking attacks.",
        status: "fail",
        severity: "warning",
        impact: "medium",
        recommendation: "Add: X-Frame-Options: DENY (or SAMEORIGIN).",
      });
    }

    if (!sh.referrerPolicy) {
      rules.push({
        id: "referrer-policy",
        category: "best-practices",
        title: "Missing Referrer-Policy header",
        description: "Without a Referrer-Policy, full URLs may be sent to third-party sites.",
        status: "fail",
        severity: "info",
        impact: "low",
        recommendation: "Add: Referrer-Policy: strict-origin-when-cross-origin",
      });
    }

    if (fetch.isHttps && !sh.strictTransportSecurity) {
      rules.push({
        id: "hsts",
        category: "best-practices",
        title: "Missing HSTS header",
        description: "Your HTTPS site doesn't enforce HSTS. Users connecting via HTTP are vulnerable to man-in-the-middle attacks.",
        status: "fail",
        severity: "warning",
        impact: "medium",
        recommendation: "Add HSTS to force all connections over HTTPS.",
      });
    }

    if (!fetch.charset) {
      rules.push({
        id: "missing-charset",
        category: "best-practices",
        title: "Missing character encoding",
        description: "No charset declaration found. Browsers may misinterpret special characters.",
        status: "fail",
        severity: "warning",
        impact: "low",
        recommendation: "Declare UTF-8 character encoding.",
      });
    }

    if (fetch.loadTimeMs > 5000) {
      rules.push({
        id: "slow-load-time",
        category: "performance",
        title: "Slow page load time",
        description: `The page took ${(fetch.loadTimeMs / 1000).toFixed(1)}s to load. Pages that take more than 3 seconds lose 53% of mobile visitors.`,
        status: "fail",
        severity: fetch.loadTimeMs > 10000 ? "critical" : "warning",
        impact: "high",
        value: `${(fetch.loadTimeMs / 1000).toFixed(1)}s`,
        recommendation: "Reduce overall page load time to under 3 seconds.",
        steps: [
          "Optimize images (compress, resize, use modern formats)",
          "Enable compression (gzip or Brotli) on your server",
          "Reduce the number of installed Shopify apps — each adds JavaScript",
          "Implement browser caching with appropriate Cache-Control headers",
        ],
      });
    }
  }

  if (psi) {
    const ndw = auditStatus(psi.audits.noDocumentWrite.score);
    if (ndw !== "skip" && ndw !== "pass") {
      rules.push({
        id: "no-document-write",
        category: "best-practices",
        title: "Uses document.write()",
        description: "document.write() blocks the HTML parser and can cause the entire page to reload on slow connections.",
        status: "fail",
        severity: "warning",
        impact: "medium",
        recommendation: "Replace all uses of document.write() with modern DOM APIs.",
      });
    }

    const doctype = auditStatus(psi.audits.doctype.score);
    if (doctype !== "skip" && doctype !== "pass") {
      rules.push({
        id: "doctype",
        category: "best-practices",
        title: "Missing DOCTYPE declaration",
        description: "Without <!DOCTYPE html>, browsers render in quirks mode with inconsistent rendering.",
        status: "fail",
        severity: "warning",
        impact: "low",
        recommendation: "Add <!DOCTYPE html> as the very first line of your HTML.",
      });
    }
  }

  // ── Shopify-Specific Rules ─────────────────────────────────────────────────

  if (fetch?.technologies?.some(t => t.name === "Shopify")) {
    const html = fetch.html ?? "";

    // Count Shopify app extension scripts
    const appScriptMatches = html.match(/cdn\.shopify\.com\/extensions/g);
    const appScriptCount = appScriptMatches?.length ?? 0;
    rules.push({
      id: "shopify-app-scripts",
      category: "performance",
      title: "Shopify app script count",
      description: `Found ${appScriptCount} Shopify app extension scripts. Each installed app can add JavaScript that impacts page load.`,
      status: appScriptCount <= 3 ? "pass" : "fail",
      severity: appScriptCount > 6 ? "critical" : "warning",
      impact: "high",
      value: `${appScriptCount} app scripts`,
      recommendation: appScriptCount > 3
        ? "Review installed apps and remove unused ones. Each app adds JS to your storefront."
        : undefined,
      steps: appScriptCount > 3 ? [
        "Go to Settings > Apps in Shopify Admin and review each installed app",
        "Uninstall apps you no longer use — they may still inject scripts",
        "For essential apps, check if they offer a 'lazy load' option",
        "Consider consolidating functionality (e.g., one reviews app instead of multiple)",
      ] : undefined,
    });

    // Check if images use Shopify CDN
    const nonCdnImages = html.match(/<img[^>]+src=["'](?!https:\/\/cdn\.shopify\.com)[^"']+["']/gi);
    const nonCdnCount = nonCdnImages?.length ?? 0;
    rules.push({
      id: "shopify-cdn-images",
      category: "performance",
      title: "Images served via Shopify CDN",
      description: nonCdnCount > 2
        ? `${nonCdnCount} images are not served through Shopify's CDN. Shopify CDN provides automatic optimization and global edge delivery.`
        : "Images are served through Shopify's CDN — good for performance.",
      status: nonCdnCount <= 2 ? "pass" : "fail",
      severity: "warning",
      impact: "medium",
      value: nonCdnCount > 0 ? `${nonCdnCount} external images` : undefined,
      recommendation: nonCdnCount > 2
        ? "Upload images to Shopify instead of hosting them externally for better performance."
        : undefined,
    });

    // Liquid render time (via Server-Timing header)
    const serverTiming = fetch.rawHeaders?.["server-timing"] ?? "";
    const liquidMatch = serverTiming.match(/liquid;dur=(\d+)/);
    if (liquidMatch) {
      const liquidMs = parseInt(liquidMatch[1]);
      rules.push({
        id: "shopify-liquid-render",
        category: "performance",
        title: "Liquid template render time",
        description: `Liquid templates took ${liquidMs}ms to render on the server. Target: under 200ms.`,
        status: liquidMs <= 200 ? "pass" : "fail",
        severity: liquidMs > 500 ? "critical" : "warning",
        impact: "high",
        value: `${liquidMs}ms`,
        recommendation: liquidMs > 200
          ? "Optimize Liquid templates to reduce server-side render time."
          : undefined,
        steps: liquidMs > 200 ? [
          "Reduce nested for-loops in Liquid templates",
          "Use pagination to limit the number of products/collections rendered",
          "Avoid using {{ all_products }} which loads all products into memory",
          "Use section rendering API for dynamic content updates",
        ] : undefined,
      });
    }

    // Count third-party scripts (not from Shopify CDN)
    const allScripts = html.match(/<script[^>]+src=["']([^"']+)["']/gi) ?? [];
    const thirdPartyScripts = allScripts.filter(s =>
      !s.includes("cdn.shopify.com") &&
      !s.includes("shopify.com") &&
      s.includes("http")
    );
    if (thirdPartyScripts.length > 5) {
      rules.push({
        id: "shopify-third-party-scripts",
        category: "performance",
        title: "Excessive third-party scripts",
        description: `Found ${thirdPartyScripts.length} third-party scripts. Each one adds latency, blocks rendering, and increases page weight.`,
        status: "fail",
        severity: thirdPartyScripts.length > 10 ? "critical" : "warning",
        impact: "high",
        value: `${thirdPartyScripts.length} scripts`,
        recommendation: "Audit and reduce third-party scripts for better performance.",
        steps: [
          "Identify which scripts are essential and which can be removed",
          "Defer non-critical scripts with async or defer attributes",
          "Consider using Google Tag Manager to manage and lazy-load third-party scripts",
          "Replace multiple analytics tools with a single solution where possible",
        ],
      });
    }
  }

  // ── Compute summary ────────────────────────────────────────────────────────

  const failCount = rules.filter((r) => r.status === "fail").length;
  const passCount = rules.filter((r) => r.status === "pass").length;
  const criticalCount = rules.filter((r) => r.status === "fail" && r.severity === "critical").length;
  const warningCount = rules.filter((r) => r.status === "fail" && r.severity === "warning").length;

  return {
    rules,
    failCount,
    passCount,
    criticalCount,
    warningCount,
    generatedAt: new Date().toISOString(),
  };
}
