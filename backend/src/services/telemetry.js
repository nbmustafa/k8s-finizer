import { config } from "../config.js";

function hashString(input) {
  return [...input].reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 100000, 7);
}

function providerLabel(provider) {
  if (provider === "aws") return "eks";
  if (provider === "gcp") return "gke";
  if (provider === "azure") return "aks";
  return "k8s";
}

export function buildClusterTelemetry({ clusterName, provider, scope }) {
  const seed = hashString(`${clusterName}:${provider}:${scope}`);
  const utilizationOffset = seed % 11;
  const nodeMultiplier = scope === "production-only" ? 0.6 : scope === "custom-namespaces" ? 0.75 : 1;
  const totalMonthlyCost = Math.round((13800 + seed % 2800) * nodeMultiplier);

  const namespaces = [
    { name: "production", pods: Math.round(145 * nodeMultiplier), cpuRequest: 88, memRequest: 340, waste_pct: 18 + (seed % 4), criticality: "high" },
    { name: "staging", pods: Math.round(92 * nodeMultiplier), cpuRequest: 42, memRequest: 180, waste_pct: 42 + (seed % 8), criticality: "medium" },
    { name: "monitoring", pods: Math.round(36 * nodeMultiplier), cpuRequest: 14, memRequest: 64, waste_pct: 22 + (seed % 6), criticality: "high" },
    { name: "dev", pods: Math.round(70 * nodeMultiplier), cpuRequest: 22, memRequest: 96, waste_pct: 57 + (seed % 8), criticality: "low" }
  ].filter((namespace) => scope !== "production-only" || namespace.name === "production");

  const nodes = [
    { type: "m5.2xlarge", count: Math.max(3, Math.round(12 * nodeMultiplier)), utilization: 18 + utilizationOffset, monthlyCost: 2534 * nodeMultiplier, purchaseOption: "on-demand" },
    { type: "m5.4xlarge", count: Math.max(2, Math.round(5 * nodeMultiplier)), utilization: 22 + (seed % 7), monthlyCost: 2120 * nodeMultiplier, purchaseOption: "on-demand" },
    { type: "r5.2xlarge", count: Math.max(2, Math.round(4 * nodeMultiplier)), utilization: 14 + (seed % 6), monthlyCost: 1524 * nodeMultiplier, purchaseOption: "reserved" },
    { type: "c5.xlarge", count: Math.max(2, Math.round(8 * nodeMultiplier)), utilization: 64 + (seed % 12), monthlyCost: 992 * nodeMultiplier, purchaseOption: "spot-ready" }
  ];

  return {
    clusterName: clusterName || `prod-${providerLabel(provider)}-${config.defaultRegion}`,
    provider,
    scope,
    region: config.defaultRegion,
    totalMonthlyCost,
    storageMonthly: Math.round(totalMonthlyCost * 0.12),
    networkMonthly: Math.round(totalMonthlyCost * 0.06),
    idleResources: {
      pods: Math.max(4, Math.round(23 * nodeMultiplier)),
      pvcs: Math.max(2, Math.round(11 * nodeMultiplier)),
      services: Math.max(1, Math.round(8 * nodeMultiplier))
    },
    nodes,
    namespaces
  };
}
