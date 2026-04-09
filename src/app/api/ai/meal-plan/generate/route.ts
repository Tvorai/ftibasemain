import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { expandAllergens, containsForbidden } from "@/lib/allergens";
import { fixMealPlanGrammar } from "@/lib/ai/fixMealPlan";

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

  if (!process.env.NOVITA_API_KEY) {
    return NextResponse.json({ message: "AI API configuration missing (NOVITA_API_KEY)." }, { status: 500 });
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
    console.log("EXPANDED ALLERGENS:", expandedAllergens);

    const FORBIDDEN_EXPRESSIONS = [
      "omeléta", "jedno pomaranč", "salát", "kuracia guláš", "mliečneho omáčkovej",
      "slepačie vajcia natvrdo", "polejte troškou", "podávané s 100 g uvarenými zemiakmi"
    ];

    let finalContent = "";
    let attempts = 0;
    const maxAttempts = 3;
    let lastAiContent = "";

    while (attempts < maxAttempts) {
      attempts++;
      
      // --- STEP 1: GENERATE PLAN ---
      const systemPrompt = `Si špičkový nutričný poradca a osobný tréner. Tvojou úlohou je vygenerovať profesionálny draft jedálnička.
VÝSTUP MUSÍ BYŤ V ČISTOM TEXTE (NIE JSON).
JAZYK: SPISOVNÁ SLOVENČINA (profesionálna, bez gramatických chýb a čechizmov).

NUTRIČNÁ LOGIKA:
- Jedlá musia byť jednoduché, realistické a sýte.
- Ak je cieľ CHUDNUTIE, nepoužívaj sladené džúsy, tekuté kalórie ani náhodné sladké doplnky.
- Zameraj sa na čisté suroviny a vyvážené makroživiny.

KRITICKÉ PRAVIDLÁ PRE ALERGÉNY (ABSOLÚTNY ZÁKAZ):
1. Ak má klient alergiu na ORECHY, NESMIE sa objaviť: arašidy, mandle, vlašské orechy, kešu, pistácie, orechové maslá ani ich stopy.
2. Ak má klient alergiu na MLIEČNE VÝROBKY, NESMIE sa objaviť: mlieko, syr, jogurt, tvaroh, smotana, maslo.
3. Ak si nie si 100% istý, či potravina patrí medzi alergény, NEPOUŽÍVAJ JU.
4. NIKDY nepoužívaj náhradu, ktorá pripomína alergén, ak si nie si istý bezpečnosťou.

ĎALŠIE TVRDÉ PRAVIDLÁ:
- NIKDY nepoužívaj slová "undefined", "null" alebo prázdne hodnoty.
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

      const userPrompt = `Prosím o vygenerovanie profesionálneho draftu jedálnička pre klienta:
- Cieľ: ${mealPlanRequest.goal}
- Výška: ${mealPlanRequest.height_cm} cm
- Vek: ${mealPlanRequest.age} rokov
- Pohlavie: ${mealPlanRequest.gender === "male" ? "Muž" : "Žena"}
- Alergény (ZAKÁZANÉ - NIKDY NEPOUŽÍVAŤ): ${expandedAllergens.length > 0 ? expandedAllergens.join(", ") : "Žiadne"}
- Obľúbené jedlá: ${mealPlanRequest.favorite_foods || "Žiadne"}
- Poznámky od trénera: ${trainerNotes || "Žiadne"}${attempts > 1 ? "\n\nUPOZORNENIE: Predchádzajúci pokus obsahoval chyby. Oprav gramatiku a nutričnú logiku." : ""}`;

      const completion = await openai.chat.completions.create({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      });

      lastAiContent = completion.choices[0].message.content || "";

      // --- STEP 2: VALIDATE + FIX (Allergens & Basics) ---
      const validationPrompt = `Si prísny revízor kvality a bezpečnosti. Skontroluj tento jedálniček:

1. Obsahuje ZAKÁZANÉ POTRAVINY (ALERGÉNY)? 
   - Alergény: ${expandedAllergens.length > 0 ? expandedAllergens.join(", ") : "Žiadne"}
2. Obsahuje "undefined", "null" alebo prázdne hodnoty?
3. Má každé jedlo kalórie v zátvorke?

AK NÁJDEŠ CHYBU:
👉 VYGENERUJ CELÚ OPRAVENÚ VERZIU.
👉 Ak je v poriadku, VRÁŤ HO BEZ ZMENY.

TEXT NA KONTROLU:
${lastAiContent}`;

      const validationCompletion = await openai.chat.completions.create({
        model: model,
        messages: [
          { role: "system", content: "Si prísny revízor. Vždy vraciaš len finálny text jedálnička." },
          { role: "user", content: validationPrompt }
        ]
      });

      let validatedContent = validationCompletion.choices[0].message.content || lastAiContent;

      // --- STEP 3: CLEANUP PASS (Language & Professionalism) ---
      const cleanupPrompt = `Oprav nasledujúci jedálniček.

CIEĽ:
- odstrániť všetky gramatické chyby (napr. 'bielej rýb', 'sezmový', 'krajka chleba', 'podliateho na zelenine')
- odstrániť neprofesionálne formulácie a čechizmy
- zabezpečiť konzistentný štýl ako od trénera (stručný, jasný)
- každé jedlo musí byť realistické (zakázané sú kombinácie ako ovocie+mäso v jednej desiate, alebo tuniak+voda+uhorka)
- žiadne texty typu 'časť z obeda', 'zvyšky z prípravy'
- zachovať kcal, štruktúru dní a VŠETKY alergénové obmedzenia.

AK NÁJDEŠ CHYBU:
👉 PREPÍŠ CELÉ JEDLO, NIE LEN OPRAV SLOVO.
👉 VRÁŤ LEN OPRAVENÝ JEDÁLNIČEK BEZ KOMENTÁRA.

TEXT NA OPRAVU:
${validatedContent}`;

      const cleanupCompletion = await openai.chat.completions.create({
        model: model,
        messages: [
          { role: "system", content: "Si špičkový nutričný editor. Vždy vraciaš len finálny, gramaticky dokonalý a profesionálny text jedálnička." },
          { role: "user", content: cleanupPrompt }
        ]
      });

      let finalStepContent = cleanupCompletion.choices[0].message.content || validatedContent;

      // --- STEP 4: PROGRAMMATIC QUALITY CHECK ---
      const hasForbiddenExpressions = FORBIDDEN_EXPRESSIONS.some(expr => 
        finalStepContent.toLowerCase().includes(expr.toLowerCase())
      );
      
      const hasAllergens = containsForbidden(finalStepContent, expandedAllergens);
      const hasNulls = finalStepContent.toLowerCase().includes("undefined") || finalStepContent.toLowerCase().includes("null");

      if (!hasForbiddenExpressions && !hasAllergens && !hasNulls) {
        finalContent = finalStepContent;
        break;
      }
      
      console.warn(`[AI Generate] Attempt ${attempts} failed quality check. Expressions: ${hasForbiddenExpressions}, Allergens: ${hasAllergens}, Nulls: ${hasNulls}. Retrying...`);
      lastAiContent = finalStepContent;
      if (attempts === maxAttempts) {
        finalContent = finalStepContent;
      }
    }

    // --- STEP 5: FINAL GRAMMAR FIX ---
    let fixedPlan = finalContent;
    try {
      fixedPlan = await fixMealPlanGrammar(finalContent);
    } catch (e) {
      console.error("[AI Generate] fixMealPlanGrammar failed, using original:", e);
      fixedPlan = finalContent;
    }

    // Consistency wrapper for storage
    const aiData = {
      format: "text",
      raw_text: fixedPlan
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
