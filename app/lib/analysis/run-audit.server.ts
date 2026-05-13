import { runPageSpeedAnalysis } from "./pagespeed";
import { runFetchAnalysis } from "./fetch-analysis";
import { runRules } from "./rules";
import { computeScores } from "./scoring";
import prisma from "../../db.server";

export async function executeAudit(auditId: string, apiKey?: string | null): Promise<void> {
  const audit = await prisma.audit.findUnique({ where: { id: auditId } });
  if (!audit) throw new Error("Audit not found");

  await prisma.audit.update({
    where: { id: auditId },
    data: { status: "running" },
  });

  try {
    // Step 1: PageSpeed Insights API (mobile)
    const psiResult = await runPageSpeedAnalysis(audit.url, "mobile", apiKey);
    const psi = psiResult?.psi ?? null;
    const screenshotDataUri = psiResult?.screenshotDataUri ?? null;

    // Step 2: Fetch analysis (HTML parsing, meta tags, tech detection)
    const fetchData = await runFetchAnalysis(audit.url);

    // Step 3: Run rule engine
    const rulesData = runRules(psi, fetchData);

    // Step 4: Compute scores
    const scores = computeScores(psi, rulesData);

    // Step 5: Extract Shopify theme name from tech detection
    const shopifyTheme = fetchData.technologies?.find(
      (t) => t.name === "Shopify Theme"
    );

    // Step 6: Store results
    await prisma.audit.update({
      where: { id: auditId },
      data: {
        status: "completed",
        performanceScore: scores.performanceScore,
        seoScore: scores.seoScore,
        accessibilityScore: scores.accessibilityScore,
        bestPracticesScore: scores.bestPracticesScore,
        overallScore: scores.overallScore,
        pagespeedData: psi ? JSON.stringify(psi) : null,
        fetchData: JSON.stringify(fetchData),
        rulesData: JSON.stringify(rulesData),
        screenshotDataUri,
        themeName: shopifyTheme?.version ?? null,
      },
    });
  } catch (error) {
    await prisma.audit.update({
      where: { id: auditId },
      data: {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}
