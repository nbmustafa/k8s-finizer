import crypto from "node:crypto";

const runs = new Map();

function createEmitter() {
  const listeners = new Set();

  return {
    emit(event) {
      listeners.forEach((listener) => listener(event));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}

export function createRun(payload) {
  const run = {
    id: crypto.randomUUID(),
    status: "queued",
    payload,
    telemetry: null,
    report: null,
    logs: [],
    steps: [],
    error: null,
    emitter: createEmitter(),
    createdAt: new Date().toISOString()
  };

  runs.set(run.id, run);
  return run;
}

export function getRun(runId) {
  return runs.get(runId);
}

export function appendLog(run, log) {
  run.logs.push(log);
  run.emitter.emit({ event: "run.log", data: log });
}

export function updateStep(run, step) {
  run.steps.push(step);
  run.emitter.emit({ event: "run.step", data: step });
}

export function setTelemetry(run, telemetry) {
  run.telemetry = telemetry;
  run.emitter.emit({ event: "run.snapshot", data: { telemetry } });
}

export function finishRun(run, report) {
  run.status = "completed";
  run.report = report;
  run.emitter.emit({ event: "run.report", data: { report, telemetry: run.telemetry } });
  run.emitter.emit({ event: "run.status", data: { status: "completed" } });
}

export function failRun(run, error) {
  run.status = "failed";
  run.error = error instanceof Error ? error.message : String(error);
  run.emitter.emit({ event: "run.status", data: { status: "failed", error: run.error } });
}
