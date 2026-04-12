import { useEffect, useMemo, useRef, useState } from "react";

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&family=Syne:wght@400;600;700;800&display=swap');`;

const AGENT_TOOLS = [
  { name: "analyze_node_utilization", icon: "⬡", desc: "Scanning node CPU and memory saturation" },
  { name: "detect_idle_resources", icon: "◈", desc: "Identifying zombie workloads and orphaned storage" },
  { name: "rightsizing_analysis", icon: "◎", desc: "Computing node and workload rightsizing paths" },
  { name: "spot_instance_scan", icon: "◆", desc: "Evaluating Spot and preemptible migration candidates" },
  { name: "namespace_cost_breakdown", icon: "▦", desc: "Allocating spend and waste by namespace" },
  { name: "reservation_optimizer", icon: "◉", desc: "Analyzing baseline capacity commitment coverage" },
  { name: "generate_report", icon: "▣", desc: "Compiling the FinOps action plan" }
];

const defaultForm = {
  clusterName: "prod-eks-us-east-1",
  provider: "aws",
  scope: "full-cluster"
};

function formatTimestamp(ts) {
  return new Date(ts).toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
}

export default function App() {
  const [phase, setPhase] = useState("idle");
  const [form, setForm] = useState(defaultForm);
  const [agentLogs, setAgentLogs] = useState([]);
  const [activeToolIdx, setActiveToolIdx] = useState(-1);
  const [completedTools, setCompletedTools] = useState([]);
  const [report, setReport] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [runId, setRunId] = useState(null);
  const [error, setError] = useState("");
  const logsEndRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [agentLogs]);

  useEffect(() => {
    return () => {
      streamRef.current?.close();
    };
  }, []);

  const stats = useMemo(() => {
    if (!snapshot) {
      return null;
    }

    return {
      nodes: snapshot.nodes.reduce((sum, node) => sum + node.count, 0),
      pods: snapshot.namespaces.reduce((sum, namespace) => sum + namespace.pods, 0)
    };
  }, [snapshot]);

  const addLog = (entry) => {
    setAgentLogs((prev) => [...prev, entry]);
  };

  const handleStreamEvent = (eventName, payload) => {
    if (eventName === "connected") {
      return;
    }

    if (eventName === "run.snapshot") {
      setSnapshot(payload.telemetry);
      return;
    }

    if (eventName === "run.log") {
      addLog(payload);
      return;
    }

    if (eventName === "run.step") {
      const toolIndex = AGENT_TOOLS.findIndex((tool) => tool.name === payload.tool);
      setActiveToolIdx(payload.status === "running" ? toolIndex : -1);

      if (payload.status === "completed" && toolIndex >= 0) {
        setCompletedTools((prev) => (prev.includes(payload.tool) ? prev : [...prev, payload.tool]));
      }
      return;
    }

    if (eventName === "run.report") {
      setReport(payload.report);
      setSnapshot(payload.telemetry);
      setPhase("done");
      setActiveToolIdx(-1);
      return;
    }

    if (eventName === "run.status") {
      if (payload.status === "failed") {
        setError(payload.error || "Agent run failed.");
        setPhase("idle");
      }
    }
  };

  const openEventStream = (nextRunId) => {
    const stream = new EventSource(`/api/runs/${nextRunId}/stream`);
    streamRef.current = stream;

    ["connected", "run.snapshot", "run.log", "run.step", "run.report", "run.status"].forEach((eventName) => {
      stream.addEventListener(eventName, (event) => {
        const payload = JSON.parse(event.data);
        handleStreamEvent(eventName, payload);
      });
    });

    stream.onerror = () => {
      stream.close();
    };
  };

  const runAgent = async () => {
    setPhase("running");
    setAgentLogs([]);
    setCompletedTools([]);
    setActiveToolIdx(-1);
    setReport(null);
    setSnapshot(null);
    setError("");
    streamRef.current?.close();

    try {
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      if (!response.ok) {
        throw new Error("Unable to start the analysis run.");
      }

      const payload = await response.json();
      setRunId(payload.runId);
      openEventStream(payload.runId);
    } catch (runError) {
      setError(runError.message);
      setPhase("idle");
    }
  };

  const impactColor = (value) => value === "HIGH" ? "#00ff88" : value === "MEDIUM" ? "#ffd700" : "#94a3b8";
  const effortColor = (value) => value === "LOW" ? "#00ff88" : value === "MEDIUM" ? "#ffd700" : "#ff6b6b";

  return (
    <>
      <style>{FONTS}{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #030712; color: #e2e8f0; font-family: 'JetBrains Mono', monospace; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #0f172a; }
        ::-webkit-scrollbar-thumb { background: #00ff88; border-radius: 2px; }
        .app { min-height: 100vh; background: radial-gradient(circle at top left, rgba(0,255,136,0.08), transparent 24%), #030712; }
        .header { border-bottom: 1px solid #1e293b; padding: 20px 32px; display: flex; align-items: center; gap: 16px; position: relative; overflow: hidden; }
        .header::before { content: ''; position: absolute; inset: 0; background: repeating-linear-gradient(90deg, transparent, transparent 60px, rgba(0,255,136,0.03) 60px, rgba(0,255,136,0.03) 61px); pointer-events: none; }
        .logo { display: flex; align-items: center; gap: 12px; }
        .logo-hex { width: 40px; height: 40px; background: #00ff88; clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%); display: flex; align-items: center; justify-content: center; font-size: 18px; animation: pulse 3s ease-in-out infinite; color: #030712; }
        .logo-text { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 18px; color: #fff; letter-spacing: -0.5px; }
        .logo-sub { font-size: 10px; color: #00ff88; letter-spacing: 3px; text-transform: uppercase; margin-top: 2px; font-weight: 400; }
        .badge { margin-left: auto; background: rgba(0,255,136,0.1); border: 1px solid rgba(0,255,136,0.3); color: #00ff88; padding: 4px 12px; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; }
        .main { display: grid; grid-template-columns: 360px 1fr; min-height: calc(100vh - 73px); }
        .sidebar { border-right: 1px solid #1e293b; padding: 24px; display: flex; flex-direction: column; gap: 24px; }
        .sidebar-title { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #475569; margin-bottom: 8px; }
        .input-group { display: flex; flex-direction: column; gap: 8px; }
        label { font-size: 11px; color: #64748b; letter-spacing: 1px; text-transform: uppercase; }
        .mono-input { background: #0f172a; border: 1px solid #1e293b; color: #e2e8f0; padding: 10px 14px; font-family: 'JetBrains Mono', monospace; font-size: 12px; width: 100%; outline: none; transition: border-color .2s; }
        .mono-input:focus { border-color: #00ff88; }
        .run-btn { background: #00ff88; color: #030712; border: none; padding: 12px 24px; font-family: 'Syne', sans-serif; font-weight: 700; font-size: 13px; letter-spacing: 2px; text-transform: uppercase; cursor: pointer; width: 100%; transition: all .2s; }
        .run-btn:hover:not(:disabled) { background: #00e87a; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,255,136,0.3); }
        .run-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .tool-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid transparent; font-size: 11px; transition: all .3s; }
        .tool-item.active { border-color: rgba(0,255,136,0.3); background: rgba(0,255,136,0.05); }
        .tool-item.done { opacity: 0.5; }
        .tool-icon { color: #00ff88; font-size: 14px; min-width: 20px; }
        .tool-name { color: #94a3b8; flex: 1; }
        .tool-item.active .tool-name { color: #e2e8f0; }
        .spinner { width: 10px; height: 10px; border: 1.5px solid #334155; border-top-color: #00ff88; border-radius: 50%; animation: spin .6s linear infinite; }
        .check { color: #00ff88; font-size: 10px; }
        .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .stat-card { background: #0f172a; border: 1px solid #1e293b; padding: 10px 12px; }
        .stat-val { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 18px; color: #fff; }
        .stat-val.green { color: #00ff88; }
        .stat-lbl { font-size: 9px; color: #475569; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 2px; }
        .content { display: flex; flex-direction: column; }
        .terminal { background: #050d1a; border-bottom: 1px solid #1e293b; padding: 20px 24px; font-size: 11px; height: 260px; overflow-y: auto; flex-shrink: 0; }
        .terminal-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        .t-dot { width: 8px; height: 8px; border-radius: 50%; }
        .t-title { font-size: 10px; color: #334155; letter-spacing: 2px; text-transform: uppercase; margin-left: 4px; }
        .log-line { display: flex; gap: 12px; line-height: 1.7; }
        .log-ts { color: #334155; min-width: 56px; }
        .log-msg.system { color: #60a5fa; }
        .log-msg.success { color: #00ff88; }
        .log-msg.tool { color: #ffd700; }
        .log-msg.highlight { color: #ff6b6b; font-weight: 700; }
        .log-msg.info { color: #64748b; }
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
        .findings-grid { display: flex; flex-direction: column; gap: 10px; margin-bottom: 32px; }
        .finding-card { background: #0a1220; border: 1px solid #1e293b; padding: 16px 20px; display: grid; grid-template-columns: 32px 1fr auto; gap: 16px; align-items: start; }
        .finding-num { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 20px; color: #1e293b; }
        .finding-title { font-size: 13px; color: #e2e8f0; font-weight: 500; margin-bottom: 4px; }
        .finding-cat { font-size: 10px; color: #475569; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 8px; }
        .finding-desc { font-size: 11px; color: #64748b; line-height: 1.7; margin-bottom: 8px; }
        .finding-action { font-size: 10px; color: #00ff88; background: rgba(0,255,136,0.05); border: 1px solid rgba(0,255,136,0.15); padding: 6px 10px; line-height: 1.5; }
        .finding-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; min-width: 100px; }
        .chip { font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase; padding: 3px 8px; border: 1px solid; }
        .savings-amt { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 16px; color: #fff; }
        .savings-period { font-size: 9px; color: #475569; }
        .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px; }
        .ns-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid #0f172a; }
        .ns-name { font-size: 12px; color: #94a3b8; flex: 1; }
        .ns-bar-wrap { flex: 2; height: 4px; background: #1e293b; }
        .ns-bar { height: 4px; background: #00ff88; transition: width 1s ease; }
        .ns-bar.warning { background: #ffd700; }
        .ns-bar.danger { background: #ff6b6b; }
        .ns-cost { font-family: 'Syne', sans-serif; font-weight: 600; font-size: 13px; color: #fff; min-width: 70px; text-align: right; }
        .ns-waste { font-size: 10px; min-width: 56px; text-align: right; }
        .roadmap { margin-bottom: 32px; }
        .phase-card { background: #0a1220; border: 1px solid #1e293b; padding: 16px 20px; display: grid; grid-template-columns: 180px 1fr auto; gap: 16px; align-items: center; margin-bottom: 8px; }
        .phase-name { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 12px; color: #fff; }
        .phase-timeline { font-size: 10px; color: #475569; margin-top: 2px; }
        .phase-actions { font-size: 11px; color: #64748b; line-height: 1.8; }
        .phase-savings { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 18px; color: #00ff88; text-align: right; }
        .phase-savings-lbl { font-size: 9px; color: #475569; text-align: right; }
        .quick-wins { background: #0a1628; border: 1px solid rgba(0,255,136,0.15); padding: 20px; margin-bottom: 32px; }
        .qw-item { display: flex; gap: 10px; align-items: flex-start; padding: 8px 0; border-bottom: 1px solid #0f172a; font-size: 12px; color: #94a3b8; line-height: 1.6; }
        .qw-item:last-child { border-bottom: none; }
        .qw-bullet { color: #00ff88; margin-top: 2px; flex-shrink: 0; }
        .idle-state { display: flex; align-items: center; justify-content: center; flex: 1; padding: 60px; }
        .idle-inner { text-align: center; max-width: 520px; }
        .idle-hex { font-size: 64px; margin-bottom: 24px; animation: float 4s ease-in-out infinite; }
        .idle-title { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 22px; color: #fff; margin-bottom: 12px; }
        .idle-desc { font-size: 12px; color: #475569; line-height: 1.8; }
        .idle-tags { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 20px; }
        .idle-tag { font-size: 10px; color: #334155; border: 1px solid #1e293b; padding: 4px 10px; letter-spacing: 1px; }
        .error-box { background: rgba(255,107,107,0.12); border: 1px solid rgba(255,107,107,0.2); color: #fecaca; padding: 12px; font-size: 11px; }
        @keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(0,255,136,0.4); } 50% { box-shadow: 0 0 0 12px rgba(0,255,136,0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
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
        <header className="header">
          <div className="logo">
            <div className="logo-hex">⬡</div>
            <div>
              <div className="logo-text">k8s-finizer</div>
              <div className="logo-sub">Kubernetes Cost Intelligence</div>
            </div>
          </div>
          <div className="badge">Powered by Anthropic</div>
        </header>

        <div className="main">
          <aside className="sidebar">
            <div>
              <div className="sidebar-title">Cluster Target</div>
              <div className="input-group">
                <label>Cluster Name / ARN</label>
                <input
                  className="mono-input"
                  value={form.clusterName}
                  onChange={(event) => setForm((prev) => ({ ...prev, clusterName: event.target.value }))}
                  disabled={phase === "running"}
                />
                <label>Cloud Provider</label>
                <select
                  className="mono-input"
                  value={form.provider}
                  onChange={(event) => setForm((prev) => ({ ...prev, provider: event.target.value }))}
                  disabled={phase === "running"}
                >
                  <option value="aws">AWS EKS</option>
                  <option value="gcp">GCP GKE</option>
                  <option value="azure">Azure AKS</option>
                  <option value="self-managed">Self-managed</option>
                </select>
                <label>Analysis Scope</label>
                <select
                  className="mono-input"
                  value={form.scope}
                  onChange={(event) => setForm((prev) => ({ ...prev, scope: event.target.value }))}
                  disabled={phase === "running"}
                >
                  <option value="full-cluster">Full Cluster (All Namespaces)</option>
                  <option value="production-only">Production Only</option>
                  <option value="custom-namespaces">Custom Namespaces</option>
                </select>
              </div>
            </div>

            <button className="run-btn" onClick={runAgent} disabled={phase === "running"}>
              {phase === "running" ? "▪ Analyzing..." : "▶ Run Cost Analysis"}
            </button>

            {error ? <div className="error-box">{error}</div> : null}

            <div>
              <div className="sidebar-title">Agent Tools</div>
              {AGENT_TOOLS.map((tool, index) => {
                const isDone = completedTools.includes(tool.name) || (phase === "done" && report);
                const isActive = index === activeToolIdx;

                return (
                  <div key={tool.name} className={`tool-item ${isActive ? "active" : isDone ? "done" : ""}`}>
                    <span className="tool-icon">{tool.icon}</span>
                    <span className="tool-name">{tool.name}</span>
                    {isActive ? <div className="spinner" /> : null}
                    {isDone ? <span className="check">✓</span> : null}
                  </div>
                );
              })}
            </div>

            {report && snapshot && stats ? (
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
                    <div className="stat-val">{stats.nodes}</div>
                    <div className="stat-lbl">Total Nodes</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-val">{stats.pods}</div>
                    <div className="stat-lbl">Running Pods</div>
                  </div>
                </div>
              </div>
            ) : null}
          </aside>

          <div className="content">
            <div className="terminal">
              <div className="terminal-header">
                <div className="t-dot" style={{ background: "#ff6b6b" }} />
                <div className="t-dot" style={{ background: "#ffd700" }} />
                <div className="t-dot" style={{ background: "#00ff88" }} />
                <span className="t-title">Agent Execution Log {runId ? `· ${runId}` : ""}</span>
              </div>
              {agentLogs.length === 0 ? (
                <div style={{ color: "#1e293b", fontSize: 12 }}>▸ Ready. Configure cluster and click Run Cost Analysis.</div>
              ) : null}
              {agentLogs.map((log, index) => (
                <div key={`${log.ts}-${index}`} className="log-line">
                  <span className="log-ts">{formatTimestamp(log.ts)}</span>
                  <span className={`log-msg ${log.type}`}>{log.msg}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>

            {phase === "idle" && !report ? (
              <div className="idle-state">
                <div className="idle-inner">
                  <div className="idle-hex">⬡</div>
                  <div className="idle-title">k8s-finizer</div>
                  <div className="idle-desc">
                    Enter a cluster name, choose provider and scope, then launch the agent. It will execute seven autonomous tools, stream every step into the terminal, and return a FinOps report with savings, risks, and a delivery roadmap.
                  </div>
                  <div className="idle-tags">
                    {["Node Rightsizing", "Spot Adoption", "Reserved Capacity", "Idle Cleanup", "Namespace Attribution", "Quick Wins"].map((tag) => (
                      <span key={tag} className="idle-tag">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {phase === "running" && !report ? (
              <div className="idle-state">
                <div className="idle-inner">
                  <div style={{ fontSize: 48, marginBottom: 20, animation: "spin 2s linear infinite", display: "inline-block" }}>⬡</div>
                  <div style={{ fontFamily: "Syne, sans-serif", fontSize: 16, color: "#fff", marginBottom: 8 }}>Agent Running Analysis</div>
                  <div style={{ fontSize: 12, color: "#475569" }}>
                    Gathering telemetry, evaluating cost opportunities, and preparing the optimization report.
                  </div>
                </div>
              </div>
            ) : null}

            {report ? (
              <div className="report">
                <div className="report-header">
                  <div>
                    <div className="report-title">k8s-finizer Report</div>
                    <div className="report-sub">
                      {snapshot?.clusterName || form.clusterName} · {form.provider.toUpperCase()} · Generated {new Date().toLocaleDateString("en-AU")}
                    </div>
                  </div>
                  <div className="savings-big">
                    <div className="savings-num">${report.projected_savings_annual.toLocaleString()}</div>
                    <div className="savings-lbl">Annual Savings Identified</div>
                    <div style={{ marginTop: 6, display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <span className="chip" style={{ color: "#00ff88", borderColor: "#00ff8840" }}>Risk: {report.risk_level}</span>
                      <span className="chip" style={{ color: "#ffd700", borderColor: "#ffd70040" }}>{report.savings_percent}% Reduction</span>
                    </div>
                  </div>
                </div>

                <div className="exec-summary">{report.executive_summary}</div>

                <div className="section-title">Top Findings</div>
                <div className="findings-grid">
                  {report.top_findings.map((finding) => (
                    <div key={finding.id} className="finding-card">
                      <div className="finding-num">{String(finding.id).padStart(2, "0")}</div>
                      <div>
                        <div className="finding-cat">{finding.category}</div>
                        <div className="finding-title">{finding.title}</div>
                        <div className="finding-desc">{finding.description}</div>
                        <div className="finding-action">⟶ {finding.action}</div>
                      </div>
                      <div className="finding-meta">
                        <span className="chip" style={{ color: impactColor(finding.impact), borderColor: `${impactColor(finding.impact)}40` }}>
                          {finding.impact} IMPACT
                        </span>
                        <span className="chip" style={{ color: effortColor(finding.effort), borderColor: `${effortColor(finding.effort)}40` }}>
                          {finding.effort} EFFORT
                        </span>
                        <div style={{ marginTop: 6, textAlign: "right" }}>
                          <div className="savings-amt">${finding.annual_savings.toLocaleString()}</div>
                          <div className="savings-period">per year</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="two-col">
                  <div>
                    <div className="section-title">Namespace Cost Breakdown</div>
                    {report.namespace_costs.map((namespace) => {
                      const maxCost = Math.max(...report.namespace_costs.map((item) => item.monthly));
                      const pct = Math.round((namespace.monthly / maxCost) * 100);
                      const wasteCls = namespace.waste_pct > 50 ? "danger" : namespace.waste_pct > 30 ? "warning" : "";

                      return (
                        <div key={namespace.name} className="ns-row">
                          <span className="ns-name">{namespace.name}</span>
                          <div className="ns-bar-wrap">
                            <div className={`ns-bar ${wasteCls}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="ns-cost">${namespace.monthly.toLocaleString()}</span>
                          <span className="ns-waste" style={{ color: namespace.waste_pct > 50 ? "#ff6b6b" : namespace.waste_pct > 30 ? "#ffd700" : "#475569" }}>
                            {namespace.waste_pct}% waste
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div>
                    <div className="section-title">Rightsizing Recommendations</div>
                    {report.rightsizing.map((item) => (
                      <div key={`${item.current}-${item.recommended}`} style={{ background: "#0a1220", border: "1px solid #1e293b", padding: "12px 16px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, color: "#e2e8f0" }}>
                            <span style={{ color: "#ff6b6b" }}>{item.current}</span>
                            <span style={{ color: "#475569", margin: "0 8px" }}>→</span>
                            <span style={{ color: "#00ff88" }}>{item.recommended}</span>
                          </div>
                          <div style={{ fontSize: 10, color: "#475569", marginTop: 4 }}>×{item.count} nodes</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 14, color: "#00ff88" }}>
                            -${item.monthly_savings.toLocaleString()}
                          </div>
                          <div style={{ fontSize: 9, color: "#475569" }}>per month</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="section-title">Quick Wins — Execute This Week</div>
                <div className="quick-wins">
                  {report.quick_wins.map((item) => (
                    <div key={item} className="qw-item">
                      <span className="qw-bullet">◆</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>

                <div className="section-title">Implementation Roadmap</div>
                <div className="roadmap">
                  {report.roadmap.map((phaseItem) => (
                    <div key={phaseItem.phase} className="phase-card">
                      <div>
                        <div className="phase-name">{phaseItem.phase}</div>
                        <div className="phase-timeline">{phaseItem.timeline}</div>
                      </div>
                      <div className="phase-actions">
                        {phaseItem.actions.map((action) => (
                          <div key={action}>▸ {action}</div>
                        ))}
                      </div>
                      <div>
                        <div className="phase-savings">${phaseItem.savings.toLocaleString()}</div>
                        <div className="phase-savings-lbl">annual savings</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
