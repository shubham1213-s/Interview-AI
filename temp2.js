// supabase/functions/openai-helpers.ts
async function readEnvFile(path) {
  const denoFile = Deno;
  if (denoFile.readTextFile) {
    return await denoFile.readTextFile(path);
  }
  if (denoFile.readTextFileSync) {
    return denoFile.readTextFileSync(path);
  }
  return void 0;
}
async function loadEnvFileKey() {
  const candidates = [];
  try {
    candidates.push(new URL("./.env", import.meta.url));
  } catch (error) {
  }
  try {
    candidates.push(new URL("../.env", import.meta.url));
  } catch (error) {
  }
  try {
    candidates.push(new URL("../../.env", import.meta.url));
  } catch (error) {
  }
  const denoCwd = Deno;
  if (typeof denoCwd.cwd === "function") {
    candidates.push(`${denoCwd.cwd()}/.env`);
    candidates.push(`${denoCwd.cwd()}/supabase/.env`);
  }
  for (const path of candidates) {
    try {
      const fileContents = await readEnvFile(path);
      if (!fileContents) continue;
      const lines = fileContents.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const [key, ...rest] = trimmed.split("=");
        if (!key) continue;
        const keyName = key.trim();
        const value = rest.join("=").trim();
        if (keyName === "OPENAI_API_KEY" || keyName === "OPENAI_KEY" || keyName === "GEMINI_API_KEY" || keyName === "GOOGLE_API_KEY") {
          return value.replace(/^\s*"|"\s*$/g, "");
        }
      }
    } catch (error) {
    }
  }
  return void 0;
}
function detectAIProvider(key) {
  if (key.startsWith("AIza") || key.startsWith("AIzaSy")) {
    return "gemini";
  }
  return "openai";
}
async function getAIKeyInfo() {
  const envKey = Deno.env.get("OPENAI_API_KEY") || Deno.env.get("OPENAI_KEY") || Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY") || await loadEnvFileKey();
  if (!envKey) return void 0;
  return { provider: detectAIProvider(envKey), key: envKey };
}
async function getOpenAIKey() {
  const aiKeyInfo = await getAIKeyInfo();
  return aiKeyInfo?.key;
}
function parseJsonFromResponse(text) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    const start = trimmed.search(/[{[]/);
    if (start === -1) {
      throw new Error("No JSON found in response text");
    }
    const opening = trimmed[start];
    const closing = opening === "{" ? "}" : "]";
    let depth = 0;
    for (let i = start; i < trimmed.length; i++) {
      const char = trimmed[i];
      if (char === opening) depth++;
      else if (char === closing) depth--;
      if (depth === 0) {
        const jsonText = trimmed.slice(start, i + 1);
        return JSON.parse(jsonText);
      }
    }
    throw new Error("Could not extract a complete JSON object or array from response text");
  }
}
export {
  getAIKeyInfo,
  getOpenAIKey,
  parseJsonFromResponse
};
