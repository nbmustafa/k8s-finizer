import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 8080),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  anthropicModel: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
  anthropicMaxTokens: Number(process.env.ANTHROPIC_MAX_TOKENS || 1600),
  defaultRegion: process.env.DEFAULT_REGION || "us-east-1",
  currency: process.env.DEFAULT_REPORT_CURRENCY || "USD"
};
