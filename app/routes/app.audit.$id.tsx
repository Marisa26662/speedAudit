import { useEffect, useState } from "react";
import type {
  HeadersFunction,
  LoaderFunctionArgs,
  ActionFunctionArgs,
} from "react-router";
import { useLoaderData, useRevalidator, Form, redirect } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import type {
  StoredPSIData,
  FetchAnalysisData,
  RulesData,
  RuleResult,
  RuleCategory,
} from "../lib/analysis/types";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const audit = await prisma.audit.findFirst({
    where: { id: params.id, shop: session.shop },
  });

  if (!audit) throw new Response("Not found", { status: 404 });

  return {
    audit: {
      id: audit.id,
      url: audit.url,
      pageType: audit.pageType,
      status: audit.status,
      errorMessage: audit.errorMessage,
      performanceScore: audit.performanceScore,
      seoScore: audit.seoScore,
      accessibilityScore: audit.accessibilityScore,
      bestPracticesScore: audit.bestPracticesScore,
      overallScore: audit.overallScore,
      themeName: audit.themeName,
      screenshotDataUri: audit.screenshotDataUri,
      createdAt: audit.createdAt.toISOString(),
      pagespeedData: audit.pagespeedData
        ? (JSON.parse(audit.pagespeedData) as StoredPSIData)
        : null,
      fetchData: audit.fetchData
        ? (JSON.parse(audit.fetchData) as FetchAnalysisData)
        : null,
      rulesData: audit.rulesData
        ? (JSON.parse(audit.rulesData) as RulesData)
        : null,
    },
  };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  if (formData.get("intent") === "delete") {
    await prisma.audit.deleteMany({
      where: { id: params.id, shop: session.shop },
    });
    return redirect("/app");
  }
  return null;
};

// ── Score Gauge ──────────────────────────────────────────────────────────────

function ScoreGauge({
  score,
  label,
  size = 110,
}: {
  score: number | null;
  label: string;
  size?: number;
}) {
  const radius = size * 0.375;
  const circumference = 2 * Math.PI * radius;
  const offset =
    score !== null
      ? circumference - (score / 100) * circumference
      : circumference;
  const color =
    score === null
      ? "#9ca3af"
      : score >= 90
      ? "#0cce6b"
      : score >= 50
      ? "#ffa400"
      : "#ff4e42";
  const center = size / 2;

  return (
    <div style={{ textAlign: "center", display: "inline-block", margin: "8px" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={size * 0.065}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={size * 0.065}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        <text
          x={center}
          y={center - 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={size * 0.24}
          fontWeight="bold"
          fill={color}
        >
          {score ?? "–"}
        </text>
      </svg>
      <div style={{ fontSize: "13px", color: "#666", marginTop: "-4px", fontWeight: 500 }}>
        {label}
      </div>
    </div>
  );
}

// ── Metric Row ───────────────────────────────────────────────────────────────

function MetricRow({
  label,
  value,
  good,
}: {
  label: string;
  value: string;
  good?: boolean | null;
}) {
  const color =
    good === true ? "#0cce6b" : good === false ? "#ff4e42" : "inherit";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "6px 0",
        borderBottom: "1px solid #f3f3f3",
      }}
    >
      <span>{label}</span>
      <span style={{ fontWeight: 600, color }}>{value}</span>
    </div>
  );
}

// ── Issue Item ───────────────────────────────────────────────────────────────

function IssueItem({ rule }: { rule: RuleResult }) {
  const [open, setOpen] = useState(false);
  const icon =
    rule.status === "pass"
      ? "\u2705"
      : rule.severity === "critical"
      ? "\ud83d\udfe5"
      : rule.severity === "warning"
      ? "\ud83d\udfe7"
      : "\ud83d\udfe6";

  return (
    <div style={{ borderBottom: "1px solid #f0f0f0", padding: "10px 0" }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          cursor: "pointer",
        }}
      >
        <span>{icon}</span>
        <span style={{ flex: 1, fontWeight: 500 }}>{rule.title}</span>
        {rule.value && (
          <span style={{ fontSize: "12px", color: "#888" }}>{rule.value}</span>
        )}
        <span style={{ fontSize: "11px", color: "#aaa" }}>
          {open ? "\u25b2" : "\u25bc"}
        </span>
      </div>
      {open && (
        <div style={{ marginTop: "8px", paddingLeft: "28px" }}>
          <p style={{ margin: "0 0 6px", fontSize: "13px", color: "#555" }}>
            {rule.description}
          </p>
          {rule.recommendation && (
            <p style={{ margin: "0 0 6px", fontSize: "13px", fontWeight: 600, color: "#333" }}>
              {rule.recommendation}
            </p>
          )}
          {rule.steps && rule.steps.length > 0 && (
            <ol style={{ margin: "6px 0", paddingLeft: "18px", fontSize: "13px", color: "#555" }}>
              {rule.steps.map((step, i) => (
                <li key={i} style={{ marginBottom: "4px" }}>{step}</li>
              ))}
            </ol>
          )}
          {rule.resources && rule.resources.length > 0 && (
            <div style={{ marginTop: "6px" }}>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "#888", textTransform: "uppercase" as const }}>
                Affected resources
              </span>
              <ul style={{ margin: "4px 0", paddingLeft: "16px", fontSize: "12px", color: "#666" }}>
                {rule.resources.slice(0, 5).map((r, i) => (
                  <li key={i} style={{ marginBottom: "2px" }}>
                    {r.url ? (r.url.length > 80 ? r.url.slice(0, 80) + "..." : r.url)
                      : r.label ?? r.node?.snippet ?? r.selector ?? "Unknown resource"}
                    {r.wastedBytes ? ` (${Math.round(r.wastedBytes / 1024)} KB wasted)` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Category Issues ──────────────────────────────────────────────────────────

function CategoryIssues({
  rules,
  category,
}: {
  rules: RuleResult[];
  category: RuleCategory;
}) {
  const categoryRules = rules.filter((r) => r.category === category);
  const failing = categoryRules
    .filter((r) => r.status === "fail")
    .sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 };
      return order[a.severity] - order[b.severity];
    });
  const passing = categoryRules.filter((r) => r.status === "pass");

  return (
    <div>
      {failing.length > 0 && (
        <div style={{ marginBottom: "16px" }}>
          <s-heading>Issues ({failing.length})</s-heading>
          {failing.map((rule) => (
            <IssueItem key={rule.id} rule={rule} />
          ))}
        </div>
      )}
      {passing.length > 0 && (
        <div>
          <s-heading>Passed ({passing.length})</s-heading>
          {passing.map((rule) => (
            <IssueItem key={rule.id} rule={rule} />
          ))}
        </div>
      )}
      {categoryRules.length === 0 && (
        <s-paragraph>No data available for this category.</s-paragraph>
      )}
    </div>
  );
}

// ── Tab Button ───────────────────────────────────────────────────────────────

const tabs = ["Overview", "Performance", "SEO", "Accessibility", "Best Practices"] as const;
type TabName = (typeof tabs)[number];

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 16px",
        border: "none",
        borderBottom: active ? "2px solid #2c6ecb" : "2px solid transparent",
        background: "none",
        cursor: "pointer",
        fontWeight: active ? 600 : 400,
        color: active ? "#2c6ecb" : "#666",
        fontSize: "14px",
      }}
    >
      {label}
    </button>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function AuditReport() {
  const { audit } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const [activeTab, setActiveTab] = useState<TabName>("Overview");

  useEffect(() => {
    if (audit.status === "pending" || audit.status === "running") {
      const interval = setInterval(() => revalidator.revalidate(), 3000);
      return () => clearInterval(interval);
    }
  }, [audit.status]);

  const psi = audit.pagespeedData;
  const fetchData = audit.fetchData;
  const rulesData = audit.rulesData;

  return (
    <s-page heading={`Audit: ${new URL(audit.url).hostname}`}>
      <div slot="primary-action">
        <Form method="post" style={{ display: "inline" }}>
          <input type="hidden" name="intent" value="delete" />
          <s-button variant="tertiary" tone="critical" type="submit">
            Delete
          </s-button>
        </Form>
      </div>

      {/* Status banners */}
      {(audit.status === "pending" || audit.status === "running") && (
        <s-banner tone="info">
          {audit.status === "pending"
            ? "Audit queued... Starting analysis shortly."
            : "Analysis in progress... This usually takes 30-60 seconds."}
          <div style={{ marginTop: "8px", background: "#e5e7eb", borderRadius: "4px", height: "6px", overflow: "hidden" }}>
            <div
              style={{
                width: audit.status === "pending" ? "10%" : "50%",
                height: "100%",
                background: "#2c6ecb",
                borderRadius: "4px",
                transition: "width 0.5s ease",
              }}
            />
          </div>
        </s-banner>
      )}

      {audit.status === "failed" && (
        <s-banner tone="critical">
          Audit failed: {audit.errorMessage || "Unknown error"}
        </s-banner>
      )}

      {/* Completed audit */}
      {audit.status === "completed" && (
        <>
          {/* Info */}
          <s-paragraph>
            {audit.pageType} · {new Date(audit.createdAt).toLocaleDateString()}
            {audit.themeName ? ` · Theme: ${audit.themeName}` : ""}
          </s-paragraph>

          {/* Score gauges */}
          <s-section>
            <div style={{ display: "flex", justifyContent: "space-around", flexWrap: "wrap" }}>
              <ScoreGauge score={audit.overallScore} label="Overall" size={140} />
              <ScoreGauge score={audit.performanceScore} label="Performance" />
              <ScoreGauge score={audit.seoScore} label="SEO" />
              <ScoreGauge score={audit.accessibilityScore} label="Accessibility" />
              <ScoreGauge score={audit.bestPracticesScore} label="Best Practices" />
            </div>
          </s-section>

          {/* Summary stats */}
          {rulesData && (
            <s-section>
              <div style={{ display: "flex", gap: "24px", justifyContent: "center" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "24px", fontWeight: 700 }}>{rulesData.passCount}</div>
                  <div style={{ fontSize: "12px", color: "#0cce6b" }}>Passed</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "24px", fontWeight: 700 }}>{rulesData.failCount}</div>
                  <div style={{ fontSize: "12px", color: "#ff4e42" }}>Failed</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "24px", fontWeight: 700 }}>{rulesData.criticalCount}</div>
                  <div style={{ fontSize: "12px", color: "#ff4e42" }}>Critical</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "24px", fontWeight: 700 }}>{rulesData.warningCount}</div>
                  <div style={{ fontSize: "12px", color: "#ffa400" }}>Warnings</div>
                </div>
              </div>
            </s-section>
          )}

          {/* Tab navigation */}
          <s-section>
            <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", marginBottom: "16px" }}>
              {tabs.map((tab) => (
                <TabButton
                  key={tab}
                  label={tab}
                  active={activeTab === tab}
                  onClick={() => setActiveTab(tab)}
                />
              ))}
            </div>

            {/* Tab content */}
            {activeTab === "Overview" && (
              <div>
                {/* Core Web Vitals */}
                {psi && (
                  <div style={{ marginBottom: "20px" }}>
                    <s-heading>Core Web Vitals</s-heading>
                    <MetricRow label="Largest Contentful Paint (LCP)" value={psi.metrics.lcp.displayValue} good={psi.metrics.lcp.value <= 2500} />
                    <MetricRow label="Cumulative Layout Shift (CLS)" value={psi.metrics.cls.displayValue} good={psi.metrics.cls.value <= 0.1} />
                    <MetricRow label="Interaction to Next Paint (INP)" value={psi.metrics.inp?.displayValue ?? "N/A"} good={(psi.metrics.inp?.value ?? 0) <= 200} />
                    <MetricRow label="Total Blocking Time (TBT)" value={psi.metrics.tbt.displayValue} good={psi.metrics.tbt.value <= 200} />
                    <MetricRow label="First Contentful Paint (FCP)" value={psi.metrics.fcp.displayValue} good={psi.metrics.fcp.value <= 1800} />
                    <MetricRow label="Speed Index" value={psi.metrics.si.displayValue} good={psi.metrics.si.value <= 3400} />
                    <MetricRow label="Time to First Byte (TTFB)" value={psi.metrics.ttfb.displayValue} good={psi.metrics.ttfb.value <= 800} />
                  </div>
                )}

                {/* Top critical issues */}
                {rulesData && rulesData.criticalCount > 0 && (
                  <div style={{ marginBottom: "20px" }}>
                    <s-heading>Critical Issues</s-heading>
                    {rulesData.rules
                      .filter((r) => r.status === "fail" && r.severity === "critical")
                      .slice(0, 5)
                      .map((rule) => (
                        <IssueItem key={rule.id} rule={rule} />
                      ))}
                  </div>
                )}

                {/* Technologies */}
                {fetchData?.technologies && fetchData.technologies.length > 0 && (
                  <div style={{ marginBottom: "20px" }}>
                    <s-heading>Detected Technologies</s-heading>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                      {fetchData.technologies.map((t) => (
                        <s-badge key={`${t.name}-${t.category}`} tone="info">
                          {t.name}{t.version ? ` ${t.version}` : ""}
                        </s-badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Screenshot */}
                {audit.screenshotDataUri && (
                  <div style={{ marginTop: "16px" }}>
                    <s-heading>Page Screenshot</s-heading>
                    <img
                      src={audit.screenshotDataUri}
                      alt="Page screenshot"
                      style={{ maxWidth: "100%", borderRadius: "8px", border: "1px solid #e5e7eb", marginTop: "8px" }}
                    />
                  </div>
                )}
              </div>
            )}

            {activeTab === "Performance" && rulesData && (
              <CategoryIssues rules={rulesData.rules} category="performance" />
            )}

            {activeTab === "SEO" && rulesData && (
              <CategoryIssues rules={rulesData.rules} category="seo" />
            )}

            {activeTab === "Accessibility" && rulesData && (
              <CategoryIssues rules={rulesData.rules} category="accessibility" />
            )}

            {activeTab === "Best Practices" && rulesData && (
              <CategoryIssues rules={rulesData.rules} category="best-practices" />
            )}
          </s-section>
        </>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
