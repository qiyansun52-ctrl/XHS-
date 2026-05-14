const MISSING_AI_API_MESSAGE =
  "AI API 当前前端进程未读取到配置，请检查 .env 中的 VITE_AI_API_URL 和 VITE_AI_API_KEY；如果你刚修改过 .env，请重启 npm run dev。";

export function resolveAiApiConfig(env = import.meta.env) {
  const baseUrl = env?.VITE_AI_API_URL?.trim();
  const apiKey = env?.VITE_AI_API_KEY?.trim();

  if (!baseUrl || !apiKey) {
    throw new Error(MISSING_AI_API_MESSAGE);
  }

  return { baseUrl, apiKey };
}
