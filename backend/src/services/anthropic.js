import { config } from "../config.js";
import { buildFallbackReport, buildPrompt } from "./reportService.js";

export async function generateReport({ telemetry, analysis, publish }) {
  const fallback = buildFallbackReport(telemetry, analysis);

  if (!config.anthropicApiKey) {
    publish.log({ type: "system", msg: "🧠 Anthropic API key not set. Using offline deterministic report synthesis." });
    return fallback;
  }

  publish.log({ type: "system", msg: "🧠 Synthesizing findings with Anthropic..." });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.anthropicApiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: config.anthropicModel,
        max_tokens: config.anthropicMaxTokens,
        messages: [
          {
            role: "user",
            content: buildPrompt(telemetry, analysis)
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic request failed with status ${response.status}`);
    }

    const body = await response.json();
    const rawText = (body.content || []).map((block) => block.text || "").join("").replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(rawText);

    return {
      ...parsed,
      total_monthly_cost: parsed.total_monthly_cost || fallback.total_monthly_cost,
      projected_savings_monthly: parsed.projected_savings_monthly || fallback.projected_savings_monthly,
      projected_savings_annual: parsed.projected_savings_annual || fallback.projected_savings_annual
    };
  } catch (error) {
    publish.log({ type: "highlight", msg: `Anthropic unavailable, falling back to deterministic synthesis: ${error.message}` });
    return fallback;
  }
}
