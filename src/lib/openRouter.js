import { OpenRouter } from "@openrouter/sdk";

const apiKey = process.env.OPENROUTER_API_KEY;
export const openrouter = apiKey
  ? new OpenRouter({
      apiKey,
    })
  : null;
