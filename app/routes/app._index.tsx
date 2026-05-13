import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const audits = await prisma.audit.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      url: true,
      pageType: true,
      status: true,
      overallScore: true,
      performanceScore: true,
      seoScore: true,
      accessibilityScore: true,
      bestPracticesScore: true,
      themeName: true,
      createdAt: true,
    },
  });

  return { audits, shop: session.shop };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const auditId = formData.get("auditId") as string;

  if (auditId) {
    await prisma.audit.deleteMany({
      where: { id: auditId, shop: session.shop },
    });
  }

  return { ok: true };
};

function scoreBadgeTone(
  score: number | null,
): "success" | "warning" | "critical" | "info" {
  if (score === null) return "info";
  if (score >= 90) return "success";
  if (score >= 50) return "warning";
  return "critical";
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <s-text color="subdued">–</s-text>;
  return (
    <s-badge tone={scoreBadgeTone(score)}>{score}</s-badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <s-badge tone="success">Completed</s-badge>;
    case "running":
      return <s-badge tone="info">Running...</s-badge>;
    case "pending":
      return <s-badge tone="info">Pending</s-badge>;
    case "failed":
      return <s-badge tone="critical">Failed</s-badge>;
    default:
      return <s-badge>{status}</s-badge>;
  }
}

function DeleteButton({ auditId }: { auditId: string }) {
  const fetcher = useFetcher();
  return (
    <fetcher.Form method="post">
      <input type="hidden" name="auditId" value={auditId} />
      <s-button variant="tertiary" tone="critical" type="submit">
        Remove
      </s-button>
    </fetcher.Form>
  );
}

function formatUrl(url: string) {
  try {
    const u = new URL(url);
    return u.pathname === "/" ? u.hostname : u.hostname + u.pathname;
  } catch {
    return url;
  }
}

export default function Dashboard() {
  const { audits } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Speed Audit Dashboard">
      <Link to="/app/audit/new" slot="primary-action">
        <s-button variant="primary">New Audit</s-button>
      </Link>

      {audits.length === 0 ? (
        <s-section heading="No audits yet">
          <s-paragraph>
            Analyze your store's performance, SEO, accessibility, and best
            practices. Get actionable recommendations to improve your
            storefront speed.
          </s-paragraph>
          <div style={{ marginTop: "12px" }}>
            <Link to="/app/audit/new">
              <s-button variant="primary">Run your first audit</s-button>
            </Link>
          </div>
        </s-section>
      ) : (
        <s-section>
          <s-table>
            <s-table-header-row>
              <s-table-header>URL</s-table-header>
              <s-table-header>Page Type</s-table-header>
              <s-table-header>Date</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header>Overall</s-table-header>
              <s-table-header>Perf</s-table-header>
              <s-table-header>SEO</s-table-header>
              <s-table-header>A11y</s-table-header>
              <s-table-header>BP</s-table-header>
              <s-table-header></s-table-header>
            </s-table-header-row>
            <s-table-body>
              {audits.map((audit) => (
                <s-table-row key={audit.id}>
                  <s-table-cell>
                    <Link to={`/app/audit/${audit.id}`}>
                      {formatUrl(audit.url)}
                    </Link>
                  </s-table-cell>
                  <s-table-cell>{audit.pageType}</s-table-cell>
                  <s-table-cell>
                    {new Date(audit.createdAt).toLocaleDateString()}
                  </s-table-cell>
                  <s-table-cell>
                    <StatusBadge status={audit.status} />
                  </s-table-cell>
                  <s-table-cell>
                    <ScoreBadge score={audit.overallScore} />
                  </s-table-cell>
                  <s-table-cell>
                    <ScoreBadge score={audit.performanceScore} />
                  </s-table-cell>
                  <s-table-cell>
                    <ScoreBadge score={audit.seoScore} />
                  </s-table-cell>
                  <s-table-cell>
                    <ScoreBadge score={audit.accessibilityScore} />
                  </s-table-cell>
                  <s-table-cell>
                    <ScoreBadge score={audit.bestPracticesScore} />
                  </s-table-cell>
                  <s-table-cell>
                    <DeleteButton auditId={audit.id} />
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        </s-section>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
