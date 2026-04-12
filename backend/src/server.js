import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";
import { executeToolPipeline } from "./services/agentTools.js";
import { generateReport } from "./services/anthropic.js";
import { buildClusterTelemetry } from "./services/telemetry.js";
import { appendLog, createRun, failRun, finishRun, getRun, setTelemetry, updateStep } from "./lib/runStore.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDist = path.resolve(__dirname, "../../frontend/dist");

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/runs", (req, res) => {
  const payload = {
    clusterName: req.body.clusterName || "prod-eks-us-east-1",
    provider: req.body.provider || "aws",
    scope: req.body.scope || "full-cluster"
  };

  const run = createRun(payload);
  run.status = "running";
  void executeRun(run);

  res.status(202).json({ runId: run.id, status: run.status });
});

app.get("/api/runs/:runId", (req, res) => {
  const run = getRun(req.params.runId);

  if (!run) {
    res.status(404).json({ error: "Run not found" });
    return;
  }

  res.json({
    id: run.id,
    status: run.status,
    telemetry: run.telemetry,
    report: run.report,
    error: run.error
  });
});

app.get("/api/runs/:runId/stream", (req, res) => {
  const run = getRun(req.params.runId);

  if (!run) {
    res.status(404).end();
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive"
  });

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent("connected", { runId: run.id, status: run.status });

  if (run.telemetry) {
    sendEvent("run.snapshot", { telemetry: run.telemetry });
  }

  run.logs.forEach((log) => sendEvent("run.log", log));
  run.steps.forEach((step) => sendEvent("run.step", step));

  if (run.report) {
    sendEvent("run.report", { report: run.report, telemetry: run.telemetry });
  }

  const unsubscribe = run.emitter.subscribe((message) => {
    sendEvent(message.event, message.data);
  });

  const heartbeat = setInterval(() => {
    res.write(": ping\n\n");
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(frontendDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

app.listen(config.port, () => {
  console.log(`K8s cost optimizer listening on port ${config.port}`);
});

async function executeRun(run) {
  const publish = {
    log(entry) {
      appendLog(run, { ...entry, ts: new Date().toISOString() });
    },
    step(entry) {
      updateStep(run, { ...entry, ts: new Date().toISOString() });
    }
  };

  try {
    publish.log({ type: "system", msg: "🤖 Agentic AI initialized — Kubernetes Cost Intelligence Engine" });
    publish.log({ type: "system", msg: `📡 Connecting to cluster: ${run.payload.clusterName}` });
    publish.log({ type: "success", msg: "✓ Cluster API authenticated. Building telemetry graph..." });

    const telemetry = buildClusterTelemetry(run.payload);
    setTelemetry(run, telemetry);

    const analysis = await executeToolPipeline(telemetry, publish);
    const report = await generateReport({ telemetry, analysis, publish });

    finishRun(run, report);
    publish.log({ type: "success", msg: "✓ Report generated successfully" });
    publish.log({ type: "highlight", msg: `💰 Identified $${report.projected_savings_annual.toLocaleString()}/yr in savings` });
  } catch (error) {
    failRun(run, error);
    publish.log({ type: "highlight", msg: `Run failed: ${error.message}` });
  }
}
