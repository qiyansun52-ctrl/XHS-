import test from "node:test";
import assert from "node:assert/strict";

import { resolveAiApiConfig } from "./runtimeConfig.js";

test("resolveAiApiConfig trims configured env values", () => {
  const config = resolveAiApiConfig({
    VITE_AI_API_URL: " http://127.0.0.1:8001 ",
    VITE_AI_API_KEY: " secret-key ",
  });

  assert.deepEqual(config, {
    baseUrl: "http://127.0.0.1:8001",
    apiKey: "secret-key",
  });
});

test("resolveAiApiConfig explains that dev server may need restart", () => {
  assert.throws(
    () =>
      resolveAiApiConfig({
        VITE_AI_API_URL: "",
        VITE_AI_API_KEY: "",
      }),
    error =>
      error instanceof Error &&
      error.message.includes("VITE_AI_API_URL") &&
      error.message.includes("VITE_AI_API_KEY") &&
      error.message.includes("重启 npm run dev"),
  );
});
