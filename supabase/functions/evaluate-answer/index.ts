import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getAIKeyInfo, parseJsonFromResponse, isLikelyOpenAIKey, analyzeKey } from "../openai-helpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function generateFallbackFeedback(answer: string): {
  score: number;
  strengths: string[];
  improvements: string[];
  detailed_feedback: string;
} {
  const wordCount = answer.trim().split(/\s+/).length;
  const hasCodeExample = answer.includes("```") || answer.includes("function") || answer.includes("class ");
  const hasStructure = answer.includes("\n") || answer.includes("1.") || answer.includes("- ");

  let score = 5.0;
  const strengths: string[] = [];
  const improvements: string[] = [];

  if (wordCount > 150) { score += 1.5; strengths.push("Comprehensive and detailed answer"); }
  else if (wordCount > 80) { score += 0.5; strengths.push("Reasonably detailed response"); }
  else { improvements.push("Consider providing more detail and elaboration"); }

  if (hasCodeExample) { score += 1.0; strengths.push("Included practical code examples"); }
  else { improvements.push("Adding code examples would strengthen your answer"); }

  if (hasStructure) { score += 0.5; strengths.push("Well-structured and organized response"); }
  else { improvements.push("Consider organizing your answer with bullet points or numbered steps"); }

  if (wordCount < 30) {
    score = Math.min(score, 4.0);
    improvements.push("The answer is too brief — aim to explain your reasoning fully");
  }

  score = Math.min(10, Math.max(1, Math.round(score * 10) / 10));

  if (strengths.length === 0) strengths.push("Addressed the question");
  if (improvements.length === 0) improvements.push("Try to provide even more real-world context");

  return {
    score,
    strengths,
    improvements,
    detailed_feedback: `Your answer demonstrates ${wordCount < 50 ? "basic" : wordCount < 150 ? "moderate" : "strong"} understanding of the topic. ${
      hasCodeExample ? "The code examples you provided are a great way to illustrate your points." : "Consider backing up your explanation with concrete code snippets."
    } ${
      hasStructure ? "Your structured approach makes the answer easy to follow." : "Organizing your thoughts with clear steps or bullet points will improve readability."
    } Overall score: ${score}/10.`,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { question, answer, role, difficulty = "medium" } = await req.json();

    if (!question || !answer) {
      return new Response(
        JSON.stringify({ error: "question and answer are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiKeyInfo = await getAIKeyInfo();

    if (aiKeyInfo) {
      const apiKey = aiKeyInfo.key;
      const provider = aiKeyInfo.provider;
      const analysis = analyzeKey(apiKey);

      if (analysis.kind === "service_account") {
        return new Response(
          JSON.stringify({ error: "Service account JSON detected. Supabase Functions require a simple API key.", details: "Service account JSON credentials are not supported by these functions. Create and set an API key instead (OpenAI 'sk-' key for transcription or Google API key starting with 'AIza' for Gemini)." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const roleText = role || "SDE";

      const systemMsg = `You are an expert technical interviewer evaluating a candidate's answer. Respond ONLY with a single JSON object (no surrounding text or markdown) matching the schema exactly.`;

      const userMsg = `Role: ${roleText}\nQuestion: ${question}\n\nCandidate's Answer: ${answer}\n\nDifficulty: ${difficulty}\n\nReturn a JSON object with this exact structure:\n{\n  "score": <number 0-10>,\n  "strengths": [<string>, ...],\n  "improvements": [<string>, ...],\n  "detailed_feedback": "<string>"\n}`;

      let content = "";

      async function callOpenAI(promptMessages: { role: string; content: string }[]) {
        if (!isLikelyOpenAIKey(apiKey)) {
          throw new Error("OpenAI API key format looks invalid. Please verify the key in your Supabase function environment.");
        }

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: promptMessages,
            temperature: 0.25,
            max_tokens: 1200,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          if (response.status === 401 || response.status === 403) {
            throw new Error(`OpenAI API key invalid or unauthorized: ${errText}`);
          }
          throw new Error(`OpenAI evaluation failed: ${response.status} ${response.statusText} - ${errText}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content?.trim() ?? "";
      }

      if (provider === "openai") {
        const messages = [
          { role: "system", content: systemMsg },
          { role: "user", content: userMsg },
        ];

        content = await callOpenAI(messages);

        // If parsing fails, ask the model again to return strictly valid JSON
        try {
          const feedback = parseJsonFromResponse(content) as {
            score: number;
            strengths: string[];
            improvements: string[];
            detailed_feedback: string;
          };
          return new Response(JSON.stringify({ ...feedback, source: provider }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } catch {
          const retryMessages = [
            { role: "system", content: systemMsg },
            { role: "user", content: userMsg },
            { role: "assistant", content: content },
            { role: "user", content: "The previous output contained extra text or invalid JSON. Reply now with ONLY the JSON object (no code fences or commentary)." },
          ];

          try {
            const second = await callOpenAI(retryMessages);
            const feedback2 = parseJsonFromResponse(second) as {
              score: number;
              strengths: string[];
              improvements: string[];
              detailed_feedback: string;
            };
            return new Response(JSON.stringify({ ...feedback2, source: provider }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          } catch {
            const feedback = generateFallbackFeedback(answer);
            return new Response(
              JSON.stringify({
                ...feedback,
                source: "heuristic",
                warning: `${provider} response could not be parsed after retry, returned fallback feedback`,
                raw_ai_response: content,
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      } else {
        const modelName = "text-bison-001";
        const endpoints = [
          `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateText?key=${encodeURIComponent(aiKeyInfo.key)}`,
          `https://generativelanguage.googleapis.com/v1beta2/models/${modelName}:generateText?key=${encodeURIComponent(aiKeyInfo.key)}`,
        ];

        let response: Response | null = null;
        let lastError: string | undefined;

        for (const url of endpoints) {
          response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              prompt: {
                text: `${systemMsg}\n\n${userMsg}`,
              },
              temperature: 0.25,
              maxOutputTokens: 1200,
            }),
          });

          if (response.ok) break;
          if (response.status === 404) {
            lastError = `404 from ${url}`;
            continue;
          }

          lastError = await response.text();
          break;
        }

        if (!response || !response.ok) {
          const details = lastError ?? "Unknown Gemini error";
          throw new Error(`Gemini evaluation failed: ${details}`);
        }

        const data = await response.json();
        content = data.candidates?.[0]?.output?.trim() ?? "";

        try {
          const feedback = parseJsonFromResponse(content) as {
            score: number;
            strengths: string[];
            improvements: string[];
            detailed_feedback: string;
          };
          return new Response(JSON.stringify({ ...feedback, source: aiKeyInfo.provider }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } catch (err) {
          const feedback = generateFallbackFeedback(answer);
          return new Response(
            JSON.stringify({
              ...feedback,
              source: "heuristic",
              warning: `${aiKeyInfo.provider} response could not be parsed, returned fallback feedback`,
              raw_ai_response: content,
              parse_error: String(err),
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    const feedback = generateFallbackFeedback(answer);
    return new Response(
      JSON.stringify({ ...feedback, source: "heuristic", note: "No AI key configured — set GEMINI_API_KEY or GOOGLE_API_KEY in your environment to enable model-based feedback." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const details = String(error);
    const status = /invalid or unauthorized/i.test(details) ? 401 : 500;
    return new Response(
      JSON.stringify({ error: "Internal server error", details }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
//supabase functions deploy