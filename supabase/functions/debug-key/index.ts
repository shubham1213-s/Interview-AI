import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getAIKeyInfo, analyzeKey } from "../openai-helpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const aiKeyInfo = await getAIKeyInfo();
    if (!aiKeyInfo) {
      return new Response(JSON.stringify({ found: false, note: "No AI key detected in environment for functions." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const analysis = analyzeKey(aiKeyInfo.key);
    return new Response(JSON.stringify({ found: true, provider: aiKeyInfo.provider, kind: analysis.kind }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
