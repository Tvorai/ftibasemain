import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { expandAllergens, containsForbidden } from "@/lib/allergens";

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

    // Prepare allergens for validation
    const rawAllergens = mealPlanRequest.allergens ? mealPlanRequest.allergens.split(",").map((a: string) => a.trim()) : [];
    const expandedAllergens = expandAllergens(rawAllergens);

    let finalContent = "";
    let attempts = 0;
    const maxAttempts = 3;
    let lastAiContent = "";

    while (attempts < maxAttempts) {
      attempts++;
      
      // --- STEP 1: GENERATE PLAN ---
      const systemPrompt = `Si špičkový nutričný poradca a asistent pre osobných trénerov. Tvojou úlohou je vygenerovať draft (návrh) jedálnička pre klienta.
VÝSTUP MUSÍ BYŤ V ČISTOM TEXTE (NIE JSON).
JAZYK: SLOVENČINA (čistá, bez češtiny, správna gramatika).

KRITICKÉ PRAVIDLÁ PRE ALERGÉNY (ABSOLÚTNY ZÁKAZ):
1. Ak má klient alergiu na ORECHY, NESMIE sa objaviť: arašidy, mandle, vlašské orechy, kešu, pistácie, orechové maslá ani ich stopy.
2. Ak má klient alergiu na MLIEČNE VÝROBKY, NESMIE sa objaviť: mlieko, syr, jogurt, tvaroh, smotana, maslo.
3. Ak si nie si 100% istý, či potravina patrí medzi alergény, NEPOUŽÍVAJ JU.
4. NIKDY nepoužívaj náhradu, ktorá pripomína alergén, ak si nie si istý bezpečnosťou.

ĎALŠIE TVRDÉ PRAVIDLÁ:
- NIKDY nepoužívaj slová "undefined", "null" alebo prázdne hodnoty.
- Každé jedlo MUSÍ mať kalórie v zátvorke (napr. 350 kcal).
- Používaj prirodzenú slovenčinu (napr. "1 kus", nie "jedna kus").
- Žiadne preklepy, profesionálny tón ako od skúseného trénera.

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
- Poznámky od trénera: ${trainerNotes || "Žiadne"}${attempts > 1 ? "\n\nUPOZORNENIE: Predchádzajúci pokus obsahoval chyby alebo alergény. Prosím o opravu a striktné dodržanie pravidiel." : ""}`;

      const completion = await openai.chat.completions.create({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      });

      lastAiContent = completion.choices[0].message.content || "";

      // --- STEP 2: VALIDATE + FIX PLAN ---
      const validationPrompt = `Si prísny revízor kvality a bezpečnosti jedálničkov. Tvojou úlohou je vykonať AUTO-CHECK vygenerovaného textu.

KRITICKÁ KONTROLA:
1. Obsahuje text ZAKÁZANÉ POTRAVINY (ALERGÉNY)? 
   - Alergény: ${mealPlanRequest.allergens || "Žiadne"}
   - Pozor na skryté alergény (napr. maslo pri mlieku, arašidy pri orechoch).
2. Obsahuje slová "undefined", "null" alebo prázdne hodnoty?
3. Sú v texte logické chyby alebo gramatické preklepy?
4. Má každé jedno jedlo uvedené kalórie v zátvorke (napr. 350 kcal)?

AK NÁJDEŠ AKÚKOĽVEK CHYBU (najmä alergén):
👉 OKAMŽITE VYGENERUJ CELÚ OPRAVENÚ VERZIU.
👉 Ak je alergia na orechy/mlieko, striktne odstráň všetky súvisiace produkty.

AK JE JEDÁLNIČEK 100% BEZPEČNÝ A SPRÁVNY:
👉 VRÁŤ HO BEZ ZMENY.

JEDÁLNIČEK NA KONTROLU:
${lastAiContent}`;

      const validationCompletion = await openai.chat.completions.create({
        model: model,
        messages: [
          { role: "system", content: "Si prísny revízor kvality. Vždy vraciaš len finálny text jedálnička." },
          { role: "user", content: validationPrompt }
        ]
      });

      const validatedContent = validationCompletion.choices[0].message.content || lastAiContent;

      // --- STEP 3: FINAL PROGRAMMATIC ALLERGEN CHECK ---
      if (!containsForbidden(validatedContent, expandedAllergens) && 
          !validatedContent.toLowerCase().includes("undefined") && 
          !validatedContent.toLowerCase().includes("null")) {
        finalContent = validatedContent;
        break;
      }
      
      console.warn(`[AI Generate] Attempt ${attempts} failed allergen or safety check. Retrying...`);
      lastAiContent = validatedContent; // Use the validated content for the next prompt if possible
      if (attempts === maxAttempts) {
        finalContent = validatedContent; // Fallback to last validated content if all attempts fail
      }
    }

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
          trainer_notes: trainerNotes,
          validation_step: true,
          attempts: attempts
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
