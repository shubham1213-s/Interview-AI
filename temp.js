// supabase/functions/generate-questions/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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

// supabase/functions/generate-questions/index.ts
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey"
};
var QUESTION_BANK = {
  SDE: {
    easy: [
      "What is the difference between a stack and a queue? Give real-world examples.",
      "Explain what Big O notation means and why it matters.",
      "What is recursion? Can you write a recursive function to compute factorial?",
      "Describe the difference between an array and a linked list.",
      "What is a hash table and when would you use one?"
    ],
    medium: [
      "Explain the concept of dynamic programming. How would you approach the longest common subsequence problem?",
      "What is the difference between BFS and DFS? When would you choose one over the other?",
      "How does a binary search tree work? What are its time complexities?",
      "Explain memory management in your preferred language. What is garbage collection?",
      "Describe the SOLID principles. Give an example of applying the Single Responsibility Principle.",
      "How would you design a rate limiter for an API?",
      "What are design patterns? Explain the Observer pattern with an example."
    ],
    hard: [
      "Design a distributed cache system. How would you handle cache invalidation and consistency?",
      "Explain consistent hashing and how it helps in distributed systems.",
      "How would you design a URL shortener that can handle millions of requests per second?",
      "What are the CAP theorem trade-offs? Give real-world examples of systems making different choices.",
      "How does a database index work internally? What are B-trees?",
      "Design a system to detect duplicate transactions in real-time with low latency."
    ]
  },
  Frontend: {
    easy: [
      "What is the difference between CSS Flexbox and Grid? When would you use each?",
      "Explain the concept of the DOM. How does JavaScript interact with it?",
      "What is the difference between `let`, `const`, and `var` in JavaScript?",
      "What is event bubbling and event capturing in JavaScript?",
      "Explain what semantic HTML is and why it matters for accessibility."
    ],
    medium: [
      "How does React's virtual DOM work and what problem does it solve?",
      "Explain the useEffect hook. What are common mistakes developers make with it?",
      "What is the difference between controlled and uncontrolled components in React?",
      "How does the browser's event loop work? What are microtasks vs macrotasks?",
      "Explain CSS specificity and how conflicts are resolved.",
      "What are Web Workers and when would you use them?",
      "How would you optimize the performance of a slow-loading web page?"
    ],
    hard: [
      "Design a component library from scratch. How would you ensure accessibility, theming, and tree-shaking?",
      "How would you implement infinite scroll with virtualization for a feed of 1 million items?",
      "Explain the rendering pipeline in the browser. How do you avoid layout thrashing?",
      "How would you architect a micro-frontend system? What are the trade-offs?",
      "Design a real-time collaborative text editor like Google Docs. What technologies would you use?",
      "How would you implement a complex state management system without external libraries?"
    ]
  },
  GenAI: {
    easy: [
      "What is the difference between supervised, unsupervised, and reinforcement learning?",
      "Explain what a transformer architecture is at a high level.",
      "What is prompt engineering? Give examples of techniques like few-shot prompting.",
      "What are embeddings and how are they used in NLP tasks?",
      "Explain the concept of fine-tuning a pre-trained model."
    ],
    medium: [
      "How does RAG (Retrieval Augmented Generation) work? What problems does it solve?",
      "What is the difference between GPT-style and BERT-style models? When would you use each?",
      "Explain the attention mechanism. Why is self-attention powerful for NLP?",
      "How would you evaluate the quality of outputs from a generative AI model?",
      "What are hallucinations in LLMs? How can you reduce them in production systems?",
      "Explain vector databases. How do they differ from traditional databases?",
      "What is chain-of-thought prompting and why does it improve reasoning?"
    ],
    hard: [
      "Design a production-grade RAG pipeline for a legal document Q&A system. What are the key challenges?",
      "How would you implement an AI agent that can use tools and reason over multi-step tasks?",
      "Explain the challenges of deploying LLMs at scale. How do you handle latency, cost, and rate limits?",
      "How does RLHF (Reinforcement Learning from Human Feedback) work? What are its limitations?",
      "Design a system to detect and mitigate prompt injection attacks in an LLM-powered application.",
      "How would you build a multi-modal AI system that processes both text and images?"
    ]
  }
};
function getQuestions(role, difficulty, count) {
  const roleBank = QUESTION_BANK[role] || QUESTION_BANK["SDE"];
  const diffBank = roleBank[difficulty] || roleBank["medium"];
  const shuffled = [...diffBank].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  try {
    const { role, difficulty = "medium", count = 5 } = await req.json();
    if (!role || !["SDE", "Frontend", "GenAI"].includes(role)) {
      return new Response(
        JSON.stringify({ error: "Invalid role. Must be SDE, Frontend, or GenAI." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const aiKeyInfo = await getAIKeyInfo();
    let questions = getQuestions(role, difficulty, count);
    let source = "bank";
    if (aiKeyInfo) {
      const prompt = `You are an expert technical interviewer. Generate ${count} interview questions for a ${role} role at ${difficulty} difficulty level.

Requirements:
- Questions should be relevant, specific, and progressively challenging
- Mix conceptual, practical, and problem-solving questions
- Each question should be a single, clear sentence or prompt
- Return ONLY a JSON array of strings, no other text

Example format: ["Question 1?", "Question 2?"]`;
      let content = "";
      if (aiKeyInfo.provider === "openai") {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${aiKeyInfo.key}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 1e3
          })
        });
        if (!response.ok) {
          throw new Error(`OpenAI question generation failed: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        content = data.choices?.[0]?.message?.content?.trim() ?? "";
      } else {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta2/models/gemini-1.5-flash:generateText?key=${encodeURIComponent(aiKeyInfo.key)}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            prompt: { text: prompt },
            temperature: 0.7,
            maxOutputTokens: 1e3
          })
        });
        if (!response.ok) {
          throw new Error(`Gemini question generation failed: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        content = data.candidates?.[0]?.output?.trim() ?? "";
      }
      try {
        const parsed = parseJsonFromResponse(content);
        if (Array.isArray(parsed)) {
          questions = parsed;
          source = aiKeyInfo.provider;
        }
      } catch (error) {
      }
    }
    return new Response(
      JSON.stringify({ questions, source }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
