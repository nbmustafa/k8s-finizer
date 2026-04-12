const TOOL_SEQUENCE = [
  { name: "analyze_node_utilization", desc: "Scanning node CPU and memory saturation" },
  { name: "detect_idle_resources", desc: "Identifying zombie workloads and orphaned storage" },
  { name: "rightsizing_analysis", desc: "Computing node and workload rightsizing paths" },
  { name: "spot_instance_scan", desc: "Evaluating Spot and preemptible migration candidates" },
  { name: "namespace_cost_breakdown", desc: "Allocating spend and waste by namespace" },
  { name: "reservation_optimizer", desc: "Analyzing baseline reservation coverage" },
  { name: "generate_report", desc: "Compiling report payload for the language model" }
];

function roundCurrency(value) {
  return Math.round(value);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function executeToolPipeline(telemetry, publish) {
  const context = {};

  for (const tool of TOOL_SEQUENCE) {
    publish.step({ tool: tool.name, status: "running" });
    publish.log({ type: "tool", msg: `→ Invoking tool: ${tool.name}` });
    publish.log({ type: "info", msg: `  ${tool.desc}...` });
    await delay(650);

    if (tool.name === "analyze_node_utilization") {
      const totalNodes = telemetry.nodes.reduce((sum, node) => sum + node.count, 0);
      const weightedUtilization = telemetry.nodes.reduce((sum, node) => sum + node.utilization * node.count, 0) / totalNodes;
      context.nodeUtilization = {
        avgUtilization: Math.round(weightedUtilization),
        underutilizedFamilies: telemetry.nodes.filter((node) => node.utilization < 35)
      };
    }

    if (tool.name === "detect_idle_resources") {
      context.idleResources = {
        monthlyWaste: roundCurrency(telemetry.idleResources.pods * 17 + telemetry.idleResources.pvcs * 40 + telemetry.idleResources.services * 5),
        details: telemetry.idleResources
      };
    }

    if (tool.name === "rightsizing_analysis") {
      context.rightsizing = telemetry.nodes
        .filter((node) => node.utilization < 40)
        .map((node) => ({
          current: node.type,
          recommended: node.type.replace("4xlarge", "2xlarge").replace("2xlarge", "xlarge"),
          count: Math.max(1, Math.floor(node.count * 0.75)),
          monthly_savings: roundCurrency((node.monthlyCost / Math.max(1, node.count)) * 0.28 * node.count)
        }));
    }

    if (tool.name === "spot_instance_scan") {
      const devNamespace = telemetry.namespaces.find((namespace) => namespace.name === "dev");
      const stagingNamespace = telemetry.namespaces.find((namespace) => namespace.name === "staging");
      context.spotCandidates = {
        monthlySavings: roundCurrency(((devNamespace?.pods || 0) + (stagingNamespace?.pods || 0)) * 8.4),
        namespaces: [devNamespace?.name, stagingNamespace?.name].filter(Boolean)
      };
    }

    if (tool.name === "namespace_cost_breakdown") {
      const totalPods = telemetry.namespaces.reduce((sum, namespace) => sum + namespace.pods, 0);
      context.namespaceCosts = telemetry.namespaces.map((namespace) => ({
        name: namespace.name,
        monthly: roundCurrency((namespace.pods / totalPods) * telemetry.totalMonthlyCost),
        waste_pct: namespace.waste_pct
      }));
    }

    if (tool.name === "reservation_optimizer") {
      const baselineNodes = telemetry.nodes.filter((node) => node.purchaseOption !== "spot-ready");
      const reservedSpend = baselineNodes.reduce((sum, node) => sum + node.monthlyCost, 0);
      context.reservation = {
        monthlySavings: roundCurrency(reservedSpend * 0.17),
        baselineNodes: baselineNodes.reduce((sum, node) => sum + node.count, 0)
      };
    }

    if (tool.name === "generate_report") {
      const monthlySavings = roundCurrency(
        context.rightsizing.reduce((sum, item) => sum + item.monthly_savings, 0) +
        context.spotCandidates.monthlySavings +
        context.idleResources.monthlyWaste +
        context.reservation.monthlySavings
      );

      context.summary = {
        monthlySavings,
        annualSavings: monthlySavings * 12,
        savingsPercent: Math.min(58, Math.round((monthlySavings / telemetry.totalMonthlyCost) * 100))
      };
    }

    publish.log({ type: "success", msg: `  ✓ ${tool.name} completed` });
    publish.step({ tool: tool.name, status: "completed" });
  }

  return context;
}

export function getToolSequence() {
  return TOOL_SEQUENCE;
}
