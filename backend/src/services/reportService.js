import { config } from "../config.js";

function rankImpact(annualSavings) {
  if (annualSavings >= 15000) return "HIGH";
  if (annualSavings >= 6000) return "MEDIUM";
  return "LOW";
}

function effortForCategory(category) {
  if (category === "Reservation Coverage" || category === "Idle Cleanup") return "LOW";
  if (category === "Spot Adoption" || category === "Resource Requests") return "MEDIUM";
  return "LOW";
}

function riskFromSavings(percent) {
  if (percent >= 35) return "LOW";
  if (percent >= 20) return "MEDIUM";
  return "HIGH";
}

export function buildPrompt(telemetry, analysis) {
  return `
You are a principal Kubernetes FinOps engineer. Review this cluster telemetry and analysis context and return ONLY valid JSON.

Telemetry:
${JSON.stringify(telemetry, null, 2)}

Analysis:
${JSON.stringify(analysis, null, 2)}

Return this exact JSON schema:
{
  "executive_summary": "string",
  "total_monthly_cost": number,
  "projected_savings_monthly": number,
  "projected_savings_annual": number,
  "savings_percent": number,
  "risk_level": "LOW|MEDIUM|HIGH",
  "top_findings": [
    {
      "id": number,
      "category": "string",
      "title": "string",
      "impact": "HIGH|MEDIUM|LOW",
      "annual_savings": number,
      "effort": "LOW|MEDIUM|HIGH",
      "description": "string",
      "action": "string"
    }
  ],
  "namespace_costs": [{ "name": "string", "monthly": number, "waste_pct": number }],
  "rightsizing": [{ "current": "string", "recommended": "string", "count": number, "monthly_savings": number }],
  "quick_wins": ["string"],
  "roadmap": [{ "phase": "string", "timeline": "string", "savings": number, "actions": ["string"] }]
}

Requirements:
- Make findings concrete and realistic.
- Keep the report scoped to ${telemetry.provider.toUpperCase()} ${telemetry.scope}.
- Use ${config.currency} amounts.
- Include 5 to 6 top findings ranked by annual savings.
`.trim();
}

export function buildFallbackReport(telemetry, analysis) {
  const topFindings = [
    {
      id: 1,
      category: "Node Rightsizing",
      title: `${analysis.rightsizing[0]?.current || "m5.2xlarge"} nodes are materially underutilized`,
      impact: rankImpact((analysis.rightsizing[0]?.monthly_savings || 0) * 12),
      annual_savings: (analysis.rightsizing[0]?.monthly_savings || 0) * 12,
      effort: "LOW",
      description: `Average fleet utilization is ${analysis.nodeUtilization.avgUtilization}% and at least ${analysis.nodeUtilization.underutilizedFamilies.length} node families are below healthy saturation.`,
      action: "Roll the least-utilized node group to the recommended smaller shape behind surge capacity."
    },
    {
      id: 2,
      category: "Spot Adoption",
      title: `Stateless namespaces ${analysis.spotCandidates.namespaces.join(" + ")} are ready for Spot capacity`,
      impact: rankImpact(analysis.spotCandidates.monthlySavings * 12),
      annual_savings: analysis.spotCandidates.monthlySavings * 12,
      effort: effortForCategory("Spot Adoption"),
      description: "Low-criticality workloads are isolated enough to use interruption-tolerant pools with autoscaler guardrails.",
      action: "Create a Spot-first node pool and pin dev and staging workloads using taints and tolerations."
    },
    {
      id: 3,
      category: "Idle Cleanup",
      title: `${telemetry.idleResources.pods} idle pods and ${telemetry.idleResources.pvcs} unattached PVCs are still accruing spend`,
      impact: rankImpact(analysis.idleResources.monthlyWaste * 12),
      annual_savings: analysis.idleResources.monthlyWaste * 12,
      effort: effortForCategory("Idle Cleanup"),
      description: "These resources have no corresponding production value but continue consuming quota and storage.",
      action: "Snapshot stale volumes, delete unattached PVCs, and enforce cleanup TTLs for non-production workloads."
    },
    {
      id: 4,
      category: "Reservation Coverage",
      title: `${analysis.reservation.baselineNodes} baseline nodes can be moved under commitments`,
      impact: rankImpact(analysis.reservation.monthlySavings * 12),
      annual_savings: analysis.reservation.monthlySavings * 12,
      effort: effortForCategory("Reservation Coverage"),
      description: "Steady-state production capacity is paying on-demand rates despite stable weekly demand.",
      action: "Purchase one-year compute commitments for the baseline production footprint after rightsizing."
    },
    {
      id: 5,
      category: "Resource Requests",
      title: "Namespace requests are oversized relative to observed runtime demand",
      impact: "MEDIUM",
      annual_savings: Math.round(telemetry.totalMonthlyCost * 0.08) * 12,
      effort: "MEDIUM",
      description: "CPU and memory requests are materially above expected P95 usage, suppressing bin-packing efficiency.",
      action: "Deploy Goldilocks or VPA in recommend mode, then update deployment requests during the next sprint."
    }
  ].sort((left, right) => right.annual_savings - left.annual_savings);

  return {
    executive_summary: `Cluster ${telemetry.clusterName} is operating with an estimated ${analysis.nodeUtilization.avgUtilization}% average node utilization and meaningful waste concentrated in non-production namespaces. The recommended actions prioritize low-risk rightsizing, Spot adoption, and idle cleanup to unlock ${analysis.summary.savingsPercent}% savings without destabilizing production workloads.`,
    total_monthly_cost: telemetry.totalMonthlyCost,
    projected_savings_monthly: analysis.summary.monthlySavings,
    projected_savings_annual: analysis.summary.annualSavings,
    savings_percent: analysis.summary.savingsPercent,
    risk_level: riskFromSavings(analysis.summary.savingsPercent),
    top_findings: topFindings.map((finding, index) => ({ ...finding, id: index + 1 })),
    namespace_costs: analysis.namespaceCosts,
    rightsizing: analysis.rightsizing,
    quick_wins: [
      `Delete ${telemetry.idleResources.pods} stale pods and ${telemetry.idleResources.pvcs} unattached PVCs this week.`,
      "Move dev and staging node pools onto Spot-first capacity with PDB protections.",
      "Reduce oversized CPU and memory requests in the noisiest non-production namespaces.",
      "Lock in baseline production capacity under one-year reservations after rightsizing."
    ],
    roadmap: [
      {
        phase: "Phase 1 — Quick Wins",
        timeline: "Week 1-2",
        savings: Math.round(analysis.idleResources.monthlyWaste * 12 + analysis.reservation.monthlySavings * 4),
        actions: ["Clean up idle resources", "Enable namespace budgets", "Introduce request recommendation reports"]
      },
      {
        phase: "Phase 2 — Fleet Optimization",
        timeline: "Week 3-6",
        savings: Math.round(analysis.rightsizing.reduce((sum, item) => sum + item.monthly_savings, 0) * 12),
        actions: ["Roll out node group rightsizing", "Tune workload requests", "Validate performance guardrails"]
      },
      {
        phase: "Phase 3 — Commitment Strategy",
        timeline: "Month 2-3",
        savings: Math.round((analysis.spotCandidates.monthlySavings + analysis.reservation.monthlySavings) * 12),
        actions: ["Purchase commitments", "Expand Spot coverage", "Review monthly FinOps KPIs with platform owners"]
      }
    ]
  };
}
