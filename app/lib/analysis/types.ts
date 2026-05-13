// ── PSI stored data (compact subset of full PSI response) ────────────────────

export interface PSIMetrics {
  fcp: { value: number; displayValue: string };
  lcp: { value: number; displayValue: string };
  tbt: { value: number; displayValue: string };
  cls: { value: number; displayValue: string };
  si: { value: number; displayValue: string };
  tti: { value: number; displayValue: string };
  ttfb: { value: number; displayValue: string };
}

export interface PSIAuditItem {
  url?: string;
  label?: string;
  totalBytes?: number;
  wastedBytes?: number;
  wastedMs?: number;
  wastedPercent?: number;
  selector?: string;
  snippet?: string;
  mimeType?: string;
  node?: { selector: string; snippet: string };
}

export interface PSIAuditResult {
  score: number | null;
  savingsBytes?: number;
  savingsMs?: number;
  displayValue?: string;
  itemCount?: number;
  items?: PSIAuditItem[];
}

export interface StoredPSIData {
  performanceScore: number;
  seoScore: number;
  accessibilityScore: number;
  bestPracticesScore: number;
  metrics: PSIMetrics;
  audits: {
    renderBlocking: PSIAuditResult;
    unusedCss: PSIAuditResult;
    unusedJs: PSIAuditResult;
    imageOptimization: PSIAuditResult;
    webpImages: PSIAuditResult;
    responsiveImages: PSIAuditResult;
    offscreenImages: PSIAuditResult;
    documentTitle: PSIAuditResult;
    metaDescription: PSIAuditResult;
    isCrawlable: PSIAuditResult;
    robotsTxt: PSIAuditResult;
    canonical: PSIAuditResult;
    structuredData: PSIAuditResult;
    tapTargets: PSIAuditResult;
    linkText: PSIAuditResult;
    imageAlt: PSIAuditResult;
    htmlLang: PSIAuditResult;
    metaViewport: PSIAuditResult;
    colorContrast: PSIAuditResult;
    buttonName: PSIAuditResult;
    formLabels: PSIAuditResult;
    usesHttps: PSIAuditResult;
    noDocumentWrite: PSIAuditResult;
    doctype: PSIAuditResult;
    charset: PSIAuditResult;
    deprecations: PSIAuditResult;
  };
  strategy: "mobile" | "desktop";
  lighthouseVersion: string;
  fetchTime: string;
}

// ── Technology detection ──────────────────────────────────────────────────────

export type { TechCategory, DetectedTech } from "./tech-detection";

// ── Fetch analysis data (from HTTP fetch + HTML parsing) ──────────────────────

export interface OpenGraphData {
  title: string | null;
  description: string | null;
  image: string | null;
  url: string | null;
  type: string | null;
}

export interface SecurityHeaders {
  xContentTypeOptions: boolean;
  xFrameOptions: boolean;
  referrerPolicy: boolean;
  strictTransportSecurity: boolean;
  contentSecurityPolicy: boolean;
  xXssProtection: boolean;
}

export interface FetchAnalysisData {
  url: string;
  finalUrl: string;
  statusCode: number;
  isHttps: boolean;
  loadTimeMs: number;
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  h1s: string[];
  h2s: string[];
  canonicalUrl: string | null;
  hasViewportMeta: boolean;
  lang: string | null;
  charset: string | null;
  openGraph: OpenGraphData;
  hasTwitterCard: boolean;
  hasRobotsTxt: boolean;
  hasSitemap: boolean;
  sitemapUrl: string | null;
  robotsMeta: string | null;
  isIndexable: boolean;
  imagesTotal: number;
  imagesMissingAlt: number;
  internalLinks: number;
  externalLinks: number;
  internalLinkUrls: string[];
  hasStructuredData: boolean;
  structuredDataTypes: string[];
  securityHeaders: SecurityHeaders;
  rawHeaders?: Record<string, string>;
  cookies?: string[];
  html?: string;
  wordCount: number;
  technologies?: import("./tech-detection").DetectedTech[];
  error?: string;
}

// ── Rule engine ───────────────────────────────────────────────────────────────

export type RuleCategory = "performance" | "seo" | "accessibility" | "best-practices";
export type RuleSeverity = "critical" | "warning" | "info";
export type RuleStatus = "pass" | "fail";
export type RuleImpact = "high" | "medium" | "low";
export type RuleDifficulty = "easy" | "moderate" | "complex";

export interface RuleResult {
  id: string;
  category: RuleCategory;
  title: string;
  description: string;
  status: RuleStatus;
  severity: RuleSeverity;
  impact: RuleImpact;
  difficulty?: RuleDifficulty;
  estimatedImpact?: number;
  value?: string;
  recommendation?: string;
  steps?: string[];
  resources?: PSIAuditItem[];
}

export interface RulesData {
  rules: RuleResult[];
  passCount: number;
  failCount: number;
  criticalCount: number;
  warningCount: number;
  generatedAt: string;
}

// ── Computed scores ───────────────────────────────────────────────────────────

export interface ComputedScores {
  performanceScore: number;
  seoScore: number;
  accessibilityScore: number;
  bestPracticesScore: number;
  overallScore: number;
}
