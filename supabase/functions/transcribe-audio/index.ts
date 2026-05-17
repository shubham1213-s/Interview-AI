import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getAIKeyInfo, analyzeKey, isLikelyOpenAIKey } from "../openai-helpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const aiKeyInfo = await getAIKeyInfo();

    if (!aiKeyInfo) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured. Voice transcription requires an OpenAI API key.", code: "NO_API_KEY" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const analysis = analyzeKey(aiKeyInfo.key);
    if (analysis.kind === "service_account") {
      return new Response(
        JSON.stringify({ error: "Service account JSON detected. Transcription requires an OpenAI 'sk-' API key.", code: "INVALID_API_KEY", details: "Service account JSON is not supported here. Create an OpenAI API key (sk-...) and set it as OPENAI_API_KEY in your Supabase Function secrets." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openAIKey = aiKeyInfo.key;

    if (!isLikelyOpenAIKey(openAIKey)) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key format looks invalid. Voice transcription requires a valid OpenAI key (Whisper). A Google Gemini key will not work for transcription.", code: "INVALID_API_KEY" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio");

    if (!audioFile || !(audioFile instanceof File)) {
      return new Response(
        JSON.stringify({ error: "No audio file provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const whisperForm = new FormData();
    whisperForm.append("file", audioFile, "audio.webm");
    whisperForm.append("model", "whisper-1");
    whisperForm.append("language", "en");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${openAIKey}` },
      body: whisperForm,
    });

    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 401 || response.status === 403) {
        return new Response(
          JSON.stringify({ error: "OpenAI API key invalid or unauthorized. Please verify your API key in the Supabase function environment.", code: "INVALID_API_KEY", details: errText }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Transcription failed", details: errText }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    return new Response(
      JSON.stringify({ text: data.text }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
