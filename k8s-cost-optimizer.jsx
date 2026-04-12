import { useState, useRef, useEffect } from "react";

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&family=Syne:wght@400;600;700;800&display=swap');`;

const MOCK_CLUSTER_DATA = {
  clusterName: "prod-eks-us-east-1",
  region: "us-east-1",
  nodes: [
    { type: "m5.2xlarge", count: 12, utilization: 18, monthlyCost: 2534 },
    { type: "m5.4xlarge", count: 5, utilization: 23, monthlyCost: 2120 },
    { type: "r5.2xlarge", count: 4, utilization: 12, monthlyCost: 1524 },
    { type: "c5.xlarge", count: 8, utilization: 67, monthlyCost: 992 },
  ],
  namespaces: [
    { name: "production", pods: 142, requests: { cpu: "88 vCPU", mem: "340 GiB" }, limits: { cpu: "220 vCPU", mem: "680 GiB" } },
    { name: "staging", pods: 89, requests: { cpu: "42 vCPU", mem: "180 GiB" }, limits: { cpu: "120 vCPU", mem: "420 GiB" } },
    { name: "monitoring", pods: 34, requests: { cpu: "12 vCPU", mem: "64 GiB" }, limits: { cpu: "24 vCPU", mem: "128 GiB" } },
    { name: "dev", pods: 67, requests: { cpu: "22 vCPU", mem: "96 GiB" }, limits: { cpu: "80 vCPU", mem: "320 GiB" } },
  ],
  totalMonthlyCost: 14280,
  storageMonthly: 1840,
  networkMonthly: 920,
  idleResources: { pods: 23, pvcs: 11, services: 8 },
};

const AGENT_TOOLS = [
  { name: "analyze_node_utilization", icon: "⬡", desc: "Scanning node CPU/Memory metrics" },
  { name: "detect_idle_resources", icon: "◈", desc: "Identifying idle workloads & PVCs" },
  { name: "rightsizing_analysis", icon: "◎", desc: "Computing rightsizing opportunities" },
  { name: "spot_instance_scan", icon: "◆", desc: "Evaluating Spot/Preemptible candidates" },
  { name: "namespace_cost_breakdown", icon: "▦", desc: "Allocating costs per namespace" },
  { name: "reservation_optimizer", icon: "◉", desc: "Analyzing Reserved Instance savings" },
  { name: "generate_report", icon: "▣", desc: "Compiling optimization report" },
];

export default function K8sCostOptimizer() {
  const [phase, setPhase] = useState("idle"); // idle | configuring | running | done
  const [clusterInput, setClusterInput] = useState("");
  const [agentLogs, setAgentLogs] = useState([]);
  const [activeToolIdx, setActiveToolIdx] = useState(-1);
  const [report, setReport] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const logsEndRef = useRef(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [agentLogs]);

  const addLog = (msg, type = "info") => {
    setAgentLogs(prev => [...prev, { msg, type, ts: new Date().toISOString().substr(11, 8) }]);
  };

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const runAgent = async () => {
    setPhase("running");
    setAgentLogs([]);
    setReport(null);
    setActiveToolIdx(-1);

    const clusterData = MOCK_CLUSTER_DATA;
    if (clusterInput.trim()) {
      clusterData.clusterName = clusterInput.trim();
    }

    addLog("🤖 Agentic AI initialized — Kubernetes Cost Intelligence Engine v2.4", "system");
    addLog(`📡 Connecting to cluster: ${clusterData.clusterName}`, "system");
    await sleep(800);
    addLog("✓ Cluster API authenticated. Fetching resource graph...", "success");
    await sleep(600);

    for (let i = 0; i < AGENT_TOOLS.length; i++) {
      setActiveToolIdx(i);
      const tool = AGENT_TOOLS[i];
      addLog(`→ Invoking tool: ${tool.name}`, "tool");
      addLog(`  ${tool.desc}...`, "info");
      await sleep(900 + Math.random() * 600);
      addLog(`  ✓ ${tool.name} completed`, "success");
    }

    addLog("🧠 Synthesizing findings with Claude AI...", "system");
    await sleep(500);

    // Call Anthropic API
    setIsTyping(true);
    try {
      const prompt = `You are a senior Kubernetes FinOps engineer. Analyze this cluster data and generate a detailed cost optimization report in JSON.

Cluster: ${JSON.stringify(clusterData, null, 2)}

Return ONLY valid JSON with this exact structure:
{
  "executive_summary": "2-3 sentence summary",
  "total_monthly_cost": number,
  "projected_savings": number,
  "savings_percent": number,
  "risk_level": "LOW|MEDIUM|HIGH",
  "top_findings": [
    {"id": 1, "category": "string", "title": "string", "impact": "HIGH|MEDIUM|LOW", "annual_savings": number, "effort": "LOW|MEDIUM|HIGH", "description": "string", "action": "string"}
  ],
  "namespace_costs": [{"name": "string", "monthly": number, "waste_pct": number}],
  "rightsizing": [{"current": "string", "recommended": "string", "count": number, "monthly_savings": number}],
  "quick_wins": ["string"],
  "roadmap": [{"phase": "string", "timeline": "string", "savings": number, "actions": ["string"]}]
}

Make it realistic with 5-6 top_findings, actual dollar amounts based on the data, and actionable recommendations.`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const data = await response.json();
      const text = data.content?.map(b => b.text || "").join("") || "";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setReport(parsed);
      addLog("✓ Report generated successfully", "success");
      addLog(`💰 Identified $${parsed.projected_savings?.toLocaleString()}/yr in savings`, "highlight");
    } catch (err) {
      // Fallback mock report
      const fallback = {
        executive_summary: "Your cluster is significantly over-provisioned with average node utilization at 22%. Immediate rightsizing and Spot adoption can save ~$67K annually with low implementation risk.",
        total_monthly_cost: 17040,
        projected_savings: 5620,
        savings_percent: 33,
        risk_level: "LOW",
        top_findings: [
          { id: 1, category: "Node Rightsizing", title: "Oversized m5.2xlarge nodes at 18% avg utilization", impact: "HIGH", annual_savings: 18240, effort: "LOW", description: "12 x m5.2xlarge nodes averaging 18% CPU and 22% memory. Downsize to m5.xlarge with no performance impact.", action: "Replace 12x m5.2xlarge → m5.xlarge via node group rolling update" },
          { id: 2, category: "Spot Instances", title: "Migrate stateless workloads to Spot", impact: "HIGH", annual_savings: 15800, effort: "MEDIUM", description: "Staging and dev namespaces host 156 stateless pods ideal for Spot/Preemptible instances (70% discount).", action: "Configure Karpenter with Spot-first strategy for staging/dev node pools" },
          { id: 3, category: "Idle Resources", title: "23 zombie pods consuming resources", impact: "MEDIUM", annual_savings: 4200, effort: "LOW", description: "23 pods in Pending/CrashLoopBackOff >7 days with active PVCs and resource requests still consuming quota.", action: "Run kubectl cleanup script, implement idle workload TTL policy" },
          { id: 4, category: "Reserved Instances", title: "Production nodes qualify for 1-yr Reserved pricing", impact: "HIGH", annual_savings: 14400, effort: "LOW", description: "8 baseline production nodes have been running 100% of the time for 6+ months. Convert to 1-yr Reserved.", action: "Purchase 8x m5.xlarge 1-yr Reserved Instances via AWS Console" },
          { id: 5, category: "Resource Requests", title: "CPU requests 3.2x over actual usage in dev namespace", impact: "MEDIUM", annual_savings: 6800, effort: "MEDIUM", description: "Dev namespace requests 22 vCPU but actual P95 usage is 6.8 vCPU. VPA/Goldilocks can auto-tune.", action: "Deploy Vertical Pod Autoscaler in recommendation mode, apply to dev namespace" },
          { id: 6, category: "Storage", title: "11 unattached PVCs wasting $440/mo", impact: "LOW", annual_savings: 5280, effort: "LOW", description: "11 PersistentVolumeClaims detached from any pod for >14 days totaling 2.2 TiB of gp2 storage.", action: "Snapshot and delete orphaned PVCs, implement PVC lifecycle policy" },
        ],
        namespace_costs: [
          { name: "production", monthly: 8240, waste_pct: 18 },
          { name: "staging", monthly: 4180, waste_pct: 54 },
          { name: "dev", monthly: 3120, waste_pct: 67 },
          { name: "monitoring", monthly: 1500, waste_pct: 22 },
        ],
        rightsizing: [
          { current: "m5.2xlarge", recommended: "m5.xlarge", count: 12, monthly_savings: 1520 },
          { current: "r5.2xlarge", recommended: "r5.xlarge", count: 3, monthly_savings: 760 },
          { current: "m5.4xlarge", recommended: "m5.2xlarge", count: 2, monthly_savings: 420 },
        ],
        quick_wins: [
          "Delete 23 zombie pods & 11 orphaned PVCs — save $590/mo in 1 hour",
          "Enable gp3 storage migration for all gp2 PVCs — save 20% storage costs automatically",
          "Set CPU/memory limits on all dev namespace deployments — prevent runaway costs",
          "Enable cluster autoscaler scale-to-zero for dev namespaces on weekends",
        ],
        roadmap: [
          { phase: "Phase 1 — Quick Wins", timeline: "Week 1–2", savings: 8400, actions: ["Delete orphaned resources", "gp2→gp3 migration", "Dev namespace limits"] },
          { phase: "Phase 2 — Rightsizing", timeline: "Week 3–6", savings: 32640, actions: ["Node group rightsizing", "VPA deployment", "Spot for staging/dev"] },
          { phase: "Phase 3 — Reserved & Architecture", timeline: "Month 2–3", savings: 29400, actions: ["Purchase Reserved Instances", "Karpenter migration", "Multi-AZ optimization"] },
        ],
      };
      setReport(fallback);
      addLog("✓ Report generated (offline mode)", "success");
      addLog(`💰 Identified $${(fallback.projected_savings * 12).toLocaleString()}/yr in savings`, "highlight");
    }

    setIsTyping(false);
    setActiveToolIdx(-1);
    setPhase("done");
  };

  const impactColor = (v) => v === "HIGH" ? "#00ff88" : v === "MEDIUM" ? "#ffd700" : "#94a3b8";
  const effortColor = (v) => v === "LOW" ? "#00ff88" : v === "MEDIUM" ? "#ffd700" : "#ff6b6b";

  return (
    <>
      <style>{FONTS}{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #030712; color: #e2e8f0; font-family: 'JetBrains Mono', monospace; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #0f172a; }
        ::-webkit-scrollbar-thumb { background: #00ff88; border-radius: 2px; }

        .app { min-height: 100vh; background: #030712; padding: 0; }

        /* HEADER */
        .header { border-bottom: 1px solid #1e293b; padding: 20px 32px; display: flex; align-items: center; gap: 16px; position: relative; overflow: hidden; }
        .header::before { content: ''; position: absolute; inset: 0; background: repeating-linear-gradient(90deg, transparent, transparent 60px, rgba(0,255,136,0.03) 60px, rgba(0,255,136,0.03) 61px); pointer-events: none; }
        .logo { display: flex; align-items: center; gap: 12px; }
        .logo-hex { width: 40px; height: 40px; background: #00ff88; clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%); display: flex; align-items: center; justify-content: center; font-size: 18px; animation: pulse 3s ease-in-out infinite; }
        @keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(0,255,136,0.4); } 50% { box-shadow: 0 0 0 12px rgba(0,255,136,0); } }
        .logo-text { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 18px; color: #fff; letter-spacing: -0.5px; }
        .logo-sub { font-size: 10px; color: #00ff88; letter-spacing: 3px; text-transform: uppercase; margin-top: 2px; font-weight: 400; }
        .badge { margin-left: auto; background: rgba(0,255,136,0.1); border: 1px solid rgba(0,255,136,0.3); color: #00ff88; padding: 4px 12px; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; }

        /* MAIN LAYOUT */
        .main { display: grid; grid-template-columns: 360px 1fr; min-height: calc(100vh - 73px); }

        /* SIDEBAR */
        .sidebar { border-right: 1px solid #1e293b; padding: 24px; display: flex; flex-direction: column; gap: 24px; }
        .sidebar-title { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #475569; margin-bottom: 8px; }
        .input-group { display: flex; flex-direction: column; gap: 8px; }
        label { font-size: 11px; color: #64748b; letter-spacing: 1px; text-transform: uppercase; }
        .mono-input { background: #0f172a; border: 1px solid #1e293b; color: #e2e8f0; padding: 10px 14px; font-family: 'JetBrains Mono', monospace; font-size: 12px; width: 100%; outline: none; transition: border-color .2s; }
        .mono-input:focus { border-color: #00ff88; }
        .mono-input::placeholder { color: #334155; }
        .run-btn { background: #00ff88; color: #030712; border: none; padding: 12px 24px; font-family: 'Syne', sans-serif; font-weight: 700; font-size: 13px; letter-spacing: 2px; text-transform: uppercase; cursor: pointer; width: 100%; transition: all .2s; position: relative; overflow: hidden; }
        .run-btn:hover:not(:disabled) { background: #00e87a; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,255,136,0.3); }
        .run-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        /* TOOL LIST */
        .tool-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid transparent; font-size: 11px; transition: all .3s; }
        .tool-item.active { border-color: rgba(0,255,136,0.3); background: rgba(0,255,136,0.05); }
        .tool-item.done { opacity: 0.5; }
        .tool-icon { color: #00ff88; font-size: 14px; min-width: 20px; }
        .tool-name { color: #94a3b8; flex: 1; }
        .tool-item.active .tool-name { color: #e2e8f0; }
        .spinner { width: 10px; height: 10px; border: 1.5px solid #334155; border-top-color: #00ff88; border-radius: 50%; animation: spin .6s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .check { color: #00ff88; font-size: 10px; }

        /* CLUSTER STATS */
        .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .stat-card { background: #0f172a; border: 1px solid #1e293b; padding: 10px 12px; }
        .stat-val { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 18px; color: #fff; }
        .stat-val.green { color: #00ff88; }
        .stat-lbl { font-size: 9px; color: #475569; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 2px; }

        /* CONTENT AREA */
        .content { display: flex; flex-direction: column; }

        /* TERMINAL */
        .terminal { background: #050d1a; border-bottom: 1px solid #1e293b; padding: 20px 24px; font-size: 11px; height: 260px; overflow-y: auto; flex-shrink: 0; }
        .terminal-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        .t-dot { width: 8px; height: 8px; border-radius: 50%; }
        .t-title { font-size: 10px; color: #334155; letter-spacing: 2px; text-transform: uppercase; margin-left: 4px; }
        .log-line { display: flex; gap: 12px; line-height: 1.7; }
        .log-ts { color: #334155; min-width: 56px; }
        .log-msg { }
        .log-msg.system { color: #60a5fa; }
        .log-msg.success { color: #00ff88; }
        .log-msg.tool { color: #ffd700; }
        .log-msg.highlight { color: #ff6b6b; font-weight: 700; }
        .log-msg.info { color: #64748b; }
        .typing { display: inline-block; width: 8px; height: 14px; background: #00ff88; animation: blink .7s step-end infinite; }
        @keyframes blink { 50% { opacity: 0; } }

        /* REPORT */
        .report { padding: 28px; overflow-y: auto; flex: 1; }
        .report-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 32px; gap: 24px; }
        .report-title { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 24px; color: #fff; }
        .report-sub { font-size: 11px; color: #475569; margin-top: 4px; letter-spacing: 1px; }
        .savings-big { text-align: right; }
        .savings-num { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 36px; color: #00ff88; }
        .savings-lbl { font-size: 10px; color: #475569; letter-spacing: 2px; text-transform: uppercase; margin-top: 2px; }

        .exec-summary { background: #0a1628; border-left: 3px solid #00ff88; padding: 16px 20px; font-size: 12px; color: #94a3b8; line-height: 1.8; margin-bottom: 28px; }

        .section-title { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #475569; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
        .section-title::after { content: ''; flex: 1; height: 1px; background: #1e293b; }

        /* FINDINGS */
        .findings-grid { display: flex; flex-direction: column; gap: 10px; margin-bottom: 32px; }
        .finding-card { background: #0a1220; border: 1px solid #1e293b; padding: 16px 20px; display: grid; grid-template-columns: 32px 1fr auto; gap: 16px; align-items: start; transition: border-color .2s; }
        .finding-card:hover { border-color: #334155; }
        .finding-num { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 20px; color: #1e293b; }
        .finding-title { font-size: 13px; color: #e2e8f0; font-weight: 500; margin-bottom: 4px; }
        .finding-cat { font-size: 10px; color: #475569; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 8px; }
        .finding-desc { font-size: 11px; color: #64748b; line-height: 1.7; margin-bottom: 8px; }
        .finding-action { font-size: 10px; color: #00ff88; background: rgba(0,255,136,0.05); border: 1px solid rgba(0,255,136,0.15); padding: 6px 10px; line-height: 1.5; }
        .finding-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; min-width: 100px; }
        .chip { font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase; padding: 3px 8px; border: 1px solid; }
        .savings-amt { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 16px; color: #fff; }
        .savings-period { font-size: 9px; color: #475569; }

        /* GRID SECTIONS */
        .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px; }

        /* NS COSTS */
        .ns-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid #0f172a; }
        .ns-name { font-size: 12px; color: #94a3b8; flex: 1; }
        .ns-bar-wrap { flex: 2; height: 4px; background: #1e293b; }
        .ns-bar { height: 4px; background: #00ff88; transition: width 1s ease; }
        .ns-bar.warning { background: #ffd700; }
        .ns-bar.danger { background: #ff6b6b; }
        .ns-cost { font-family: 'Syne', sans-serif; font-weight: 600; font-size: 13px; color: #fff; min-width: 70px; text-align: right; }
        .ns-waste { font-size: 10px; min-width: 40px; text-align: right; }

        /* ROADMAP */
        .roadmap { margin-bottom: 32px; }
        .phase-card { background: #0a1220; border: 1px solid #1e293b; padding: 16px 20px; display: grid; grid-template-columns: 180px 1fr auto; gap: 16px; align-items: center; margin-bottom: 8px; }
        .phase-name { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 12px; color: #fff; }
        .phase-timeline { font-size: 10px; color: #475569; margin-top: 2px; }
        .phase-actions { font-size: 11px; color: #64748b; line-height: 1.8; }
        .phase-savings { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 18px; color: #00ff88; text-align: right; }
        .phase-savings-lbl { font-size: 9px; color: #475569; text-align: right; }

        /* QUICK WINS */
        .quick-wins { background: #0a1628; border: 1px solid rgba(0,255,136,0.15); padding: 20px; margin-bottom: 32px; }
        .qw-item { display: flex; gap: 10px; align-items: flex-start; padding: 8px 0; border-bottom: 1px solid #0f172a; font-size: 12px; color: #94a3b8; line-height: 1.6; }
        .qw-item:last-child { border-bottom: none; }
        .qw-bullet { color: #00ff88; margin-top: 2px; flex-shrink: 0; }

        /* IDLE LANDING */
        .idle-state { display: flex; align-items: center; justify-content: center; flex: 1; padding: 60px; }
        .idle-inner { text-align: center; max-width: 480px; }
        .idle-hex { font-size: 64px; margin-bottom: 24px; animation: float 4s ease-in-out infinite; }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
        .idle-title { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 22px; color: #fff; margin-bottom: 12px; }
        .idle-desc { font-size: 12px; color: #475569; line-height: 1.8; }
        .idle-tags { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 20px; }
        .idle-tag { font-size: 10px; color: #334155; border: 1px solid #1e293b; padding: 4px 10px; letter-spacing: 1px; }

        @media (max-width: 900px) {
          .main { grid-template-columns: 1fr; }
          .sidebar { border-right: none; border-bottom: 1px solid #1e293b; }
          .two-col { grid-template-columns: 1fr; }
          .phase-card { grid-template-columns: 1fr; gap: 8px; }
          .finding-card { grid-template-columns: 1fr; }
          .report-header { flex-direction: column; }
        }
      `}</style>

      <div className="app">
        {/* HEADER */}
        <header className="header">
          <div className="logo">
            <div className="logo-hex">⬡</div>
            <div>
              <div className="logo-text">K8s FinOps Agent</div>
              <div className="logo-sub">Cost Intelligence Engine</div>
            </div>
          </div>
          <div className="badge">Powered by Claude AI</div>
        </header>

        <div className="main">
          {/* SIDEBAR */}
          <aside className="sidebar">
            <div>
              <div className="sidebar-title">Cluster Target</div>
              <div className="input-group">
                <label>Cluster Name / ARN</label>
                <input
                  className="mono-input"
                  placeholder="prod-eks-us-east-1"
                  value={clusterInput}
                  onChange={e => setClusterInput(e.target.value)}
                  disabled={phase === "running"}
                />
                <label>Cloud Provider</label>
                <select className="mono-input" disabled={phase === "running"} style={{ cursor: "pointer" }}>
                  <option>AWS EKS</option>
                  <option>GCP GKE</option>
                  <option>Azure AKS</option>
                  <option>Self-managed</option>
                </select>
                <label>Analysis Scope</label>
                <select className="mono-input" disabled={phase === "running"} style={{ cursor: "pointer" }}>
                  <option>Full Cluster (All Namespaces)</option>
                  <option>Production Only</option>
                  <option>Custom Namespaces</option>
                </select>
              </div>
            </div>

            <button className="run-btn" onClick={runAgent} disabled={phase === "running"}>
              {phase === "running" ? "▪ Analyzing..." : "▶ Run Cost Analysis"}
            </button>

            {/* TOOL STATUS */}
            <div>
              <div className="sidebar-title">Agent Tools</div>
              {AGENT_TOOLS.map((t, i) => (
                <div key={t.name} className={`tool-item ${i === activeToolIdx ? "active" : i < activeToolIdx || phase === "done" ? "done" : ""}`}>
                  <span className="tool-icon">{t.icon}</span>
                  <span className="tool-name">{t.name}</span>
                  {i === activeToolIdx && <div className="spinner" />}
                  {(i < activeToolIdx || phase === "done") && <span className="check">✓</span>}
                </div>
              ))}
            </div>

            {/* CLUSTER STATS (shown when done) */}
            {report && (
              <div>
                <div className="sidebar-title">Cluster Snapshot</div>
                <div className="stat-grid">
                  <div className="stat-card">
                    <div className="stat-val">${(report.total_monthly_cost / 1000).toFixed(1)}K</div>
                    <div className="stat-lbl">Monthly Spend</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-val green">{report.savings_percent}%</div>
                    <div className="stat-lbl">Savings Opp.</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-val">29</div>
                    <div className="stat-lbl">Total Nodes</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-val">332</div>
                    <div className="stat-lbl">Running Pods</div>
                  </div>
                </div>
              </div>
            )}
          </aside>

          {/* CONTENT */}
          <div className="content">
            {/* TERMINAL */}
            <div className="terminal">
              <div className="terminal-header">
                <div className="t-dot" style={{ background: "#ff6b6b" }} />
                <div className="t-dot" style={{ background: "#ffd700" }} />
                <div className="t-dot" style={{ background: "#00ff88" }} />
                <span className="t-title">Agent Execution Log</span>
              </div>
              {agentLogs.length === 0 && (
                <div style={{ color: "#1e293b", fontSize: 12 }}>
                  ▸ Ready. Configure cluster and click Run Cost Analysis.
                </div>
              )}
              {agentLogs.map((log, i) => (
                <div key={i} className="log-line">
                  <span className="log-ts">{log.ts}</span>
                  <span className={`log-msg ${log.type}`}>{log.msg}</span>
                </div>
              ))}
              {isTyping && (
                <div className="log-line">
                  <span className="log-ts">...</span>
                  <span className="log-msg system">Claude AI synthesizing<span className="typing" /></span>
                </div>
              )}
              <div ref={logsEndRef} />
            </div>

            {/* REPORT or IDLE */}
            {phase === "idle" && (
              <div className="idle-state">
                <div className="idle-inner">
                  <div className="idle-hex">⬡</div>
                  <div className="idle-title">Kubernetes Cost Intelligence</div>
                  <div className="idle-desc">
                    Configure your cluster target and launch the AI agent. It will autonomously analyze node utilization, detect idle resources, compute rightsizing opportunities, and generate an actionable FinOps report.
                  </div>
                  <div className="idle-tags">
                    {["Node Rightsizing", "Spot Adoption", "Reserved Instances", "Idle Cleanup", "VPA Tuning", "Namespace Attribution"].map(t => (
                      <span key={t} className="idle-tag">{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {phase === "running" && !report && (
              <div className="idle-state">
                <div className="idle-inner">
                  <div style={{ fontSize: 48, marginBottom: 20, animation: "spin 2s linear infinite", display: "inline-block" }}>⬡</div>
                  <div style={{ fontFamily: "Syne, sans-serif", fontSize: 16, color: "#fff", marginBottom: 8 }}>Agent Running Analysis</div>
                  <div style={{ fontSize: 12, color: "#475569" }}>Scanning cluster resources and computing optimization opportunities...</div>
                </div>
              </div>
            )}

            {report && (
              <div className="report">
                {/* HEADER */}
                <div className="report-header">
                  <div>
                    <div className="report-title">Cost Optimization Report</div>
                    <div className="report-sub">{clusterInput || "prod-eks-us-east-1"} · Generated {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                  </div>
                  <div className="savings-big">
                    <div className="savings-num">
                      ${(report.projected_savings * 12).toLocaleString()}
                    </div>
                    <div className="savings-lbl">Annual Savings Identified</div>
                    <div style={{ marginTop: 6, display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <span className="chip" style={{ color: "#00ff88", borderColor: "#00ff8840" }}>Risk: {report.risk_level}</span>
                      <span className="chip" style={{ color: "#ffd700", borderColor: "#ffd70040" }}>{report.savings_percent}% Reduction</span>
                    </div>
                  </div>
                </div>

                {/* EXEC SUMMARY */}
                <div className="exec-summary">{report.executive_summary}</div>

                {/* TOP FINDINGS */}
                <div className="section-title">Top Findings</div>
                <div className="findings-grid">
                  {report.top_findings?.map(f => (
                    <div key={f.id} className="finding-card">
                      <div className="finding-num">{String(f.id).padStart(2, "0")}</div>
                      <div>
                        <div className="finding-cat">{f.category}</div>
                        <div className="finding-title">{f.title}</div>
                        <div className="finding-desc">{f.description}</div>
                        <div className="finding-action">⟶ {f.action}</div>
                      </div>
                      <div className="finding-meta">
                        <span className="chip" style={{ color: impactColor(f.impact), borderColor: impactColor(f.impact) + "40" }}>
                          {f.impact} IMPACT
                        </span>
                        <span className="chip" style={{ color: effortColor(f.effort), borderColor: effortColor(f.effort) + "40" }}>
                          {f.effort} EFFORT
                        </span>
                        <div style={{ marginTop: 6, textAlign: "right" }}>
                          <div className="savings-amt">${f.annual_savings?.toLocaleString()}</div>
                          <div className="savings-period">per year</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* TWO COL */}
                <div className="two-col">
                  {/* NAMESPACE COSTS */}
                  <div>
                    <div className="section-title">Namespace Cost Breakdown</div>
                    {report.namespace_costs?.map(ns => {
                      const maxCost = Math.max(...report.namespace_costs.map(n => n.monthly));
                      const pct = Math.round((ns.monthly / maxCost) * 100);
                      const wasteCls = ns.waste_pct > 50 ? "danger" : ns.waste_pct > 30 ? "warning" : "";
                      return (
                        <div key={ns.name} className="ns-row">
                          <span className="ns-name">{ns.name}</span>
                          <div className="ns-bar-wrap">
                            <div className={`ns-bar ${wasteCls}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="ns-cost">${ns.monthly.toLocaleString()}</span>
                          <span className="ns-waste" style={{ color: ns.waste_pct > 50 ? "#ff6b6b" : ns.waste_pct > 30 ? "#ffd700" : "#475569" }}>
                            {ns.waste_pct}% waste
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* RIGHTSIZING */}
                  <div>
                    <div className="section-title">Rightsizing Recommendations</div>
                    {report.rightsizing?.map((r, i) => (
                      <div key={i} style={{ background: "#0a1220", border: "1px solid #1e293b", padding: "12px 16px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, color: "#e2e8f0" }}>
                            <span style={{ color: "#ff6b6b" }}>{r.current}</span>
                            <span style={{ color: "#475569", margin: "0 8px" }}>→</span>
                            <span style={{ color: "#00ff88" }}>{r.recommended}</span>
                          </div>
                          <div style={{ fontSize: 10, color: "#475569", marginTop: 4 }}>×{r.count} nodes</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 14, color: "#00ff88" }}>
                            -${r.monthly_savings?.toLocaleString()}
                          </div>
                          <div style={{ fontSize: 9, color: "#475569" }}>per month</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* QUICK WINS */}
                <div className="section-title">Quick Wins — Execute This Week</div>
                <div className="quick-wins">
                  {report.quick_wins?.map((qw, i) => (
                    <div key={i} className="qw-item">
                      <span className="qw-bullet">◆</span>
                      <span>{qw}</span>
                    </div>
                  ))}
                </div>

                {/* ROADMAP */}
                <div className="section-title">Implementation Roadmap</div>
                <div className="roadmap">
                  {report.roadmap?.map((ph, i) => (
                    <div key={i} className="phase-card">
                      <div>
                        <div className="phase-name">{ph.phase}</div>
                        <div className="phase-timeline">{ph.timeline}</div>
                      </div>
                      <div className="phase-actions">
                        {ph.actions?.map((a, j) => (
                          <div key={j}>▸ {a}</div>
                        ))}
                      </div>
                      <div>
                        <div className="phase-savings">${ph.savings?.toLocaleString()}</div>
                        <div className="phase-savings-lbl">annual savings</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ textAlign: "center", padding: "20px 0 8px", fontSize: 10, color: "#1e293b", letterSpacing: 2 }}>
                  GENERATED BY K8S FINOPS AGENT · POWERED BY CLAUDE AI · {new Date().toISOString().substr(0, 10)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
