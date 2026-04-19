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
    .select("id, trainer_id, name, goal, height_cm, age, gender, allergens, favorite_foods, duration_days")
    .eq("id", mealPlanRequestId)
    .eq("trainer_id", trainer.id)
    .maybeSingle();

  console.log("[FETCH AUDIT] api/ai/meal-plan/generate = POST");
  console.log("[FETCH AUDIT] table = meal_plan_requests");
  console.log("[FETCH AUDIT] old select = *");
  console.log("[FETCH AUDIT] new select = id, trainer_id, name, goal, height_cm, age, gender, allergens, favorite_foods, duration_days");

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
      "slepačie vajcia natvrdo", "polejte troškou", "podávané s 100 g uvarenými zemiakmi",
      "bielej rýb", "sezmový", "krajka chleba", "podliateho na zelenine"
    ];

    let finalContent = "";
    let attempts = 0;
    const maxAttempts = 2; // Reduced to prevent timeouts
    let lastAiContent = "";

    while (attempts < maxAttempts) {
      attempts++;
      
      const duration = mealPlanRequest.duration_days || 7;
      
      // --- STEP 1: GENERATE PROFESSIONAL PLAN (Combined Generation & Style) ---
      const systemPrompt = `Si špičkový nutričný poradca a profesionálny osobný tréner. Tvojou úlohou je vygenerovať DOKONALÝ draft jedálnička na ${duration} dní.
VÝSTUP MUSÍ BYŤ V ČISTOM TEXTE (NIE JSON).
JAZYK: ČISTÁ SPISOVNÁ SLOVENČINA (bez gramatických chýb, bez čechizmov).

STRIKTNÉ PRAVIDLÁ:
1. ALERGÉNY (ABSOLÚTNY ZÁKAZ): Ak má klient alergiu na ORECHY alebo MLIEČNE VÝROBKY, nesmieš použiť nič z daného zoznamu (ani syr, maslo, arašidy, atď.).
2. NUTRIČNÁ LOGIKA: Jedlá musia byť realistické, sýte a profesionálne. Žiadne divné kombinácie (mäso s ovocím v jednej desiate a pod.).
3. ŠTÝL: Text musí pôsobiť ako platený produkt od prémiového trénera. Používaj gramáž a jednoduchý popis.
4. FORMÁT: Každé jedlo MUSÍ mať kalórie v zátvorke (napr. 350 kcal).
5. DĹŽKA PLÁNU: Vygeneruj presne ${duration} dní.
   - Ak je dĺžka 7 dní, použi formát: [ Pondelok ], [ Utorok ], ..., [ Nedeľa ].
   - Ak je dĺžka 30 dní, použi formát: [ Deň 1 ], [ Deň 2 ], ..., [ Deň 30 ]. Môžeš to rozdeliť do týždňov, ale každý deň musí byť jasne označený.

FORMÁT VÝSTUPU:
JEDÁLNIČEK NA ${duration} DNÍ:

[ ${duration === 7 ? "Pondelok" : "Deň 1"} ]
- **Raňajky (350 kcal)**: ...
- **Desiata (200 kcal)**: ...
- **Obed (450 kcal)**: ...
- **Olovrant (150 kcal)**: ...
- **Večera (300 kcal)**: ...

(prázdny riadok medzi dňami)`;

      const userPrompt = `Prosím o vygenerovanie špičkového draftu jedálnička na ${duration} dní:
- Cieľ: ${mealPlanRequest.goal}
- Parametre: ${mealPlanRequest.gender === "male" ? "Muž" : "Žena"}, ${mealPlanRequest.age} r., ${mealPlanRequest.height_cm} cm
- Alergény (ABSOLÚTNY ZÁKAZ): ${expandedAllergens.length > 0 ? expandedAllergens.join(", ") : "Žiadne"}
- Obľúbené jedlá: ${mealPlanRequest.favorite_foods || "Žiadne"}
- Poznámky: ${trainerNotes || "Žiadne"}`;

      const completion = await openai.chat.completions.create({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3 // Balanced for quality and consistency
      });

      lastAiContent = completion.choices[0].message.content || "";

      // --- STEP 2: VALIDATE + CLEANUP (Single pass for everything) ---
      const validationPrompt = `Skontroluj a oprav nasledujúci jedálniček.
CIEĽ: 100% bezpečnosť (alergény) a 100% gramatická správnosť.

PRAVIDLÁ:
1. Obsahuje ZAKÁZANÉ POTRAVINY? (${expandedAllergens.join(", ")}) Ak áno, nahraď celé jedlo bezpečnou alternatívou.
2. Sú tam gramatické chyby, čechizmy alebo "undefined"? Ak áno, oprav ich do spisovnej slovenčiny.
3. Má každé jedlo kcal v zátvorke?

Vráť LEN finálny opravený text jedálnička bez komentára.

TEXT NA KONTROLU:
${lastAiContent}`;

      const validationCompletion = await openai.chat.completions.create({
        model: model,
        messages: [
          { role: "system", content: "Si prísny revízor a editor jedálničkov. Vždy vraciaš len finálny text." },
          { role: "user", content: validationPrompt }
        ],
        temperature: 0.1 // High precision
      });

      const validatedContent = validationCompletion.choices[0].message.content || lastAiContent;

      // --- STEP 3: PROGRAMMATIC QUALITY CHECK ---
      const hasForbiddenExpressions = FORBIDDEN_EXPRESSIONS.some(expr => 
        validatedContent.toLowerCase().includes(expr.toLowerCase())
      );
      
      const hasAllergens = containsForbidden(validatedContent, expandedAllergens);
      const hasNulls = validatedContent.toLowerCase().includes("undefined") || validatedContent.toLowerCase().includes("null");

      if (!hasForbiddenExpressions && !hasAllergens && !hasNulls) {
        finalContent = validatedContent;
        break;
      }
      
      console.warn(`[AI Generate] Attempt ${attempts} failed quality check. Expressions: ${hasForbiddenExpressions}, Allergens: ${hasAllergens}, Nulls: ${hasNulls}. Retrying...`);
      if (attempts === maxAttempts) {
        finalContent = validatedContent;
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
