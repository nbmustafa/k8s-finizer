# Kubernetes Cost Optimizer

Agentic AI application that analyzes Kubernetes spend, streams a seven-step autonomous pipeline to the UI, and generates a FinOps report backed by Anthropic with a deterministic offline fallback.

## Architecture

- `frontend/`: React + Vite operator console using live SSE updates.
- `backend/`: Express API that runs the optimization agent pipeline and synthesizes the report.
- `deploy/kubernetes/`: Kubernetes deployment assets for the application itself.
- `Dockerfile`: multi-stage build that compiles the frontend and packages the backend into a single runtime image.

## Agent Pipeline

The backend executes these tools in order:

1. `analyze_node_utilization`
2. `detect_idle_resources`
3. `rightsizing_analysis`
4. `spot_instance_scan`
5. `namespace_cost_breakdown`
6. `reservation_optimizer`
7. `generate_report`

Each step emits structured logs over Server-Sent Events so the UI can render a live terminal.

## Local Development

```bash
npm install
npm run dev
```

Frontend runs on `http://localhost:5173` and proxies API requests to the backend on `http://localhost:8080`.

## Environment

Copy `.env.example` to `backend/.env` or export the variables in your shell.

- `ANTHROPIC_API_KEY`: optional; when absent the backend uses an offline deterministic report generator.
- `ANTHROPIC_MODEL`: Anthropic model ID used for report synthesis.
- `PORT`: API port for the backend container and local runtime.

## Container Build

```bash
docker build -t k8s-cost-optimizer:latest .
docker run -p 8080:8080 --env-file backend/.env k8s-cost-optimizer:latest
```

## Kubernetes Deployment

Apply the manifests after creating the Anthropic secret:

```bash
kubectl create namespace finops
kubectl create secret generic k8s-cost-optimizer-secrets \
  --namespace finops \
  --from-literal=ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY"
kubectl apply -f deploy/kubernetes/
```

## Production Notes

- The current telemetry layer generates a realistic cluster snapshot when direct cluster credentials are not wired in yet.
- To plug in live cluster reads, replace `buildClusterTelemetry` in `backend/src/services/telemetry.js` with calls to the Kubernetes metrics and cloud billing APIs.
- SSE run state is in-memory today; use Redis or Postgres if you need horizontal fan-out across replicas.
