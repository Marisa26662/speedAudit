import type { StoredPSIData, RulesData, ComputedScores, RuleCategory } from "./types";

function categoryScoreFromRules(rules: RulesData, category: RuleCategory): number {
  const cat = rules.rules.filter((r) => r.category === category);
  if (cat.length === 0) return 0;
  const passed = cat.filter((r) => r.status === "pass").length;
  return Math.round((passed / cat.length) * 100);
}

/**
 * Compute weighted overall score.
 * Weights: Performance 40%, SEO 30%, Accessibility 20%, Best Practices 10%
 */
export function computeScores(
  psi: StoredPSIData | null,
  rules: RulesData
): ComputedScores {
  const performanceScore =
    psi?.performanceScore ?? categoryScoreFromRules(rules, "performance");
  const seoScore = psi?.seoScore ?? categoryScoreFromRules(rules, "seo");
  const accessibilityScore =
    psi?.accessibilityScore ?? categoryScoreFromRules(rules, "accessibility");
  const bestPracticesScore =
    psi?.bestPracticesScore ?? categoryScoreFromRules(rules, "best-practices");

  const overallScore = Math.round(
    performanceScore * 0.4 +
      seoScore * 0.3 +
      accessibilityScore * 0.2 +
      bestPracticesScore * 0.1
  );

  return {
    performanceScore,
    seoScore,
    accessibilityScore,
    bestPracticesScore,
    overallScore,
  };
}
