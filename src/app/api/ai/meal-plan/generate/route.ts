import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

function getBearerToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (!auth) return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ message: "Server configuration missing." }, { status: 500 });
  }

  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Verify user and get trainer_id
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  // Check if user is a trainer and get their trainer_id
  const { data: trainer, error: trainerError } = await supabase
    .from("trainers")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (trainerError || !trainer) {
    return NextResponse.json({ message: "Only trainers can generate AI drafts." }, { status: 403 });
  }

  const body = await request.json();
  const { mealPlanRequestId, trainerNotes } = body;

  if (!mealPlanRequestId) {
    return NextResponse.json({ message: "Missing mealPlanRequestId." }, { status: 400 });
  }

  // Fetch meal plan request
  const { data: mealPlanRequest, error: fetchError } = await supabase
    .from("meal_plan_requests")
    .select("*")
    .eq("id", mealPlanRequestId)
    .eq("trainer_id", trainer.id)
    .maybeSingle();

  if (fetchError || !mealPlanRequest) {
    return NextResponse.json({ message: "Meal plan request not found or access denied." }, { status: 404 });
  }

  // Update status to generating
  await supabase
    .from("meal_plan_requests")
    .update({ 
      ai_generation_status: "generating",
      ai_last_error: null
    })
    .eq("id", mealPlanRequestId);

  try {
    const openai = new OpenAI({
      apiKey: process.env.NOVITA_API_KEY,
      baseURL: process.env.NOVITA_BASE_URL || "https://api.novita.ai/openai",
    });

    const model = process.env.NOVITA_MODEL || "qwen/qwen3.5-35b-a3b";

    // --- STEP 1: GENERATE PLAN ---
    const systemPrompt = `Si špičkový nutričný poradca a asistent pre osobných trénerov. Tvojou úlohou je vygenerovať draft (návrh) jedálnička pre klienta.
VÝSTUP MUSÍ BYŤ V ČISTOM TEXTE (NIE JSON).
JAZYK: SLOVENČINA (čistá, bez češtiny).

TVRDÉ PRAVIDLÁ:
- NIKDY nepoužívaj zakázané potraviny (alergény) ani ako alternatívu.
- NIKDY nepoužívaj slová "undefined" alebo "null".
- Každé jedlo MUSÍ mať kalórie v zátvorke (napr. 350 kcal).
- Používaj prirodzenú slovenčinu (napr. "1 kus", nie "jedna kus").
- Žiadne preklepy, profesionálny tón.

FORMÁT VÝSTUPU:
JEDÁLNIČEK:

[ Pondelok ]
- **Raňajky (350 kcal)**: ...
- **Desiata (200 kcal)**: ...
- **Obed (450 kcal)**: ...
- **Olovrant (150 kcal)**: ...
- **Večera (300 kcal)**: ...

(prázdny riadok medzi dňami)`;

    const userPrompt = `Prosím o vygenerovanie draftu jedálnička pre klienta s týmito parametrami:
- Cieľ: ${mealPlanRequest.goal}
- Výška: ${mealPlanRequest.height_cm} cm
- Vek: ${mealPlanRequest.age} rokov
- Pohlavie: ${mealPlanRequest.gender === "male" ? "Muž" : "Žena"}
- Alergény (ZAKÁZANÉ POTRAVINY): ${mealPlanRequest.allergens || "Žiadne"}
- Obľúbené jedlá: ${mealPlanRequest.favorite_foods || "Žiadne"}
- Poznámky od trénera: ${trainerNotes || "Žiadne"}`;

    const completion = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    });

    let aiContent = completion.choices[0].message.content || "";

    // --- STEP 2: VALIDATE + FIX PLAN ---
    const validationPrompt = `Si revízor jedálničkov. Skontroluj tento jedálniček a ak porušuje pravidlá, PREPÍŠ HO tak, aby bol dokonalý.

PRAVIDLÁ NA KONTROLU:
1. Obsahuje zakázané potraviny (alergény)? Ak áno, nahraď ich.
2. Obsahuje slová "undefined", "null" alebo chýbajúce hodnoty? Ak áno, doplň ich.
3. Má každé jedlo kalórie v zátvorke (napr. 350 kcal)?
4. Je slovenčina gramaticky správna (žiadna čeština)?
5. Sú dodržané všetky parametre klienta?

ZAKÁZANÉ POTRAVINY (ALERGÉNY): ${mealPlanRequest.allergens || "Žiadne"}

AK JE JEDÁLNIČEK V PORIADKU, VRÁŤ HO BEZ ZMENY.
AK JE V ŇOM CHYBA, VRÁŤ CELÚ OPRAVENÚ VERZIU V ROVNAKOM FORMÁTE.

JEDÁLNIČEK NA KONTROLU:
${aiContent}`;

    const validationCompletion = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: "Si prísny revízor kvality. Vždy vraciaš len finálny text jedálnička." },
        { role: "user", content: validationPrompt }
      ]
    });

    const finalContent = validationCompletion.choices[0].message.content || aiContent;

    // Consistency wrapper for storage
    const aiData = {
      format: "text",
      raw_text: finalContent
    };

    // Save AI draft to DB
    await supabase
      .from("meal_plan_requests")
      .update({
        ai_generation_status: "ready",
        ai_generated_plan: aiData,
        ai_prompt_input: {
          system_prompt: systemPrompt,
          user_prompt: userPrompt,
          trainer_notes: trainerNotes,
          validation_step: true
        },
        ai_generated_at: new Date().toISOString()
      })
      .eq("id", mealPlanRequestId);

    return NextResponse.json({
      status: "ready",
      data: aiData
    });

  } catch (error: unknown) {
    console.error("[AI Generate] error:", error);
    const errorMessage = error instanceof Error ? error.message : "An error occurred during AI generation.";
    
    await supabase
      .from("meal_plan_requests")
      .update({
        ai_generation_status: "failed",
        ai_last_error: errorMessage
      })
      .eq("id", mealPlanRequestId);

    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
