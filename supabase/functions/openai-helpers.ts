async function readEnvFile(path: string | URL): Promise<string | undefined> {
  const denoFile = Deno as unknown as {
    readTextFile?: (path: string | URL) => Promise<string>;
    readTextFileSync?: (path: string | URL) => string;
  };
  if (denoFile.readTextFile) {
    return await denoFile.readTextFile(path);
  }
  if (denoFile.readTextFileSync) {
    return denoFile.readTextFileSync(path);
  }
  return undefined;
}

async function loadEnvFileKey(): Promise<string | undefined> {
  const candidates: Array<string | URL> = [];

  try {
    candidates.push(new URL("./.env", import.meta.url)); // supabase/functions/.env
  } catch {
    // ignore invalid URL resolution
  }

  try {
    candidates.push(new URL("../.env", import.meta.url)); // supabase/.env
  } catch {
    // ignore invalid URL resolution
  }

  try {
    candidates.push(new URL("../../.env", import.meta.url)); // project/.env
  } catch {
    // ignore invalid URL resolution
  }

  const denoCwd = Deno as unknown as { cwd?: () => string };
  if (typeof denoCwd.cwd === "function") {
    candidates.push(`${denoCwd.cwd()}/.env`);
    candidates.push(`${denoCwd.cwd()}/supabase/.env`);
  }

  for (const path of candidates) {
    try {
      const fileContents = await readEnvFile(path);
      if (!fileContents) continue;

      let openAIKey: string | undefined;
      let geminiKey: string | undefined;
      let googleKey: string | undefined;

      const lines = fileContents.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const [key, ...rest] = trimmed.split("=");
        if (!key) continue;
        const keyName = key.trim();
        const value = rest.join("=").trim().replace(/^\s*"|"\s*$/g, "");

        if (keyName === "OPENAI_API_KEY" || keyName === "OPENAI_KEY" || keyName === "VITE_OPENAI_API_KEY" || keyName === "VITE_OPENAI_KEY") {
          openAIKey = value;
        } else if (keyName === "GEMINI_API_KEY" || keyName === "VITE_GEMINI_API_KEY") {
          geminiKey = value;
        } else if (keyName === "GOOGLE_API_KEY" || keyName === "VITE_GOOGLE_API_KEY") {
          googleKey = value;
        }
      }

      if (openAIKey) return openAIKey;
      if (geminiKey) return geminiKey;
      if (googleKey) return googleKey;
    } catch (error) {
      // Ignore path-specific errors.
    }
  }

  return undefined;
}

export type AIProvider = "openai" | "gemini";

export interface AIKeyInfo {
  provider: AIProvider;
  key: string;
}

export type KeyKind = "openai" | "google_api_key" | "service_account" | "unknown";

function detectKeyKind(key: string): KeyKind {
  const trimmed = key.trim();

  // Service account JSON detection
  if (trimmed.startsWith("{") && /"type"\s*:\s*"service_account"/.test(trimmed)) {
    return "service_account";
  }

  if (/^(sk-|v2-)[A-Za-z0-9-_]{20,}$/.test(trimmed)) return "openai";
  if (/^(AIza|AIzaSy)[A-Za-z0-9-_]{20,}$/.test(trimmed)) return "google_api_key";
  return "unknown";
}

function detectAIProvider(key: string): AIProvider {
  const kind = detectKeyKind(key);
  if (kind === "openai") return "openai";
  return "gemini";
}

export function isLikelyOpenAIKey(key: string): boolean {
  return /^(sk-|v2-)[A-Za-z0-9-_]{20,}$/.test(key);
}

export function isLikelyGeminiKey(key: string): boolean {
  return /^(AIza|AIzaSy)[A-Za-z0-9-_]{20,}$/.test(key);
}

export async function getAIKeyInfo(): Promise<AIKeyInfo | undefined> {
  const envKey =
    Deno.env.get("OPENAI_API_KEY") ||
    Deno.env.get("OPENAI_KEY") ||
    Deno.env.get("VITE_OPENAI_API_KEY") ||
    Deno.env.get("VITE_OPENAI_KEY") ||
    Deno.env.get("GEMINI_API_KEY") ||
    Deno.env.get("VITE_GEMINI_API_KEY") ||
    Deno.env.get("GOOGLE_API_KEY") ||
    Deno.env.get("VITE_GOOGLE_API_KEY") ||
    await loadEnvFileKey();
  if (!envKey) return undefined;
  return { provider: detectAIProvider(envKey), key: envKey };
}

export function analyzeKey(key: string): { provider: AIProvider; kind: KeyKind } {
  const kind = detectKeyKind(key);
  const provider = kind === "openai" ? "openai" : "gemini";
  return { provider, kind };
}

export async function getOpenAIKey(): Promise<string | undefined> {
  const envKey =
    Deno.env.get("OPENAI_API_KEY") ||
    Deno.env.get("OPENAI_KEY") ||
    Deno.env.get("VITE_OPENAI_API_KEY") ||
    Deno.env.get("VITE_OPENAI_KEY") ||
    await loadEnvFileKey();

  if (!envKey) return undefined;
  if (detectAIProvider(envKey) !== "openai") return undefined;
  return envKey;
}

export function parseJsonFromResponse(text: string): unknown {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    const start = trimmed.search(/[{[]/); // find object or array opening bracket
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
