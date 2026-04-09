import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

// Define the expected output structure for the AI
const MEAL_PLAN_STRUCTURE = {
  client_summary: "Brief summary of the client and their needs (max 2 sentences)",
  goal_summary: "Brief explanation of how the plan meets the user's goal",
  calorie_target: "Estimated daily calorie target (XXXX kcal)",
  macros: {
    protein: "Protein target (XXX g)",
    carbs: "Carbs target (XXX g)",
    fats: "Fats target (XXX g)"
  },
  recommendations: [
    "List of max 5 short, professional recommendations"
  ],
  meal_plan_days: [
    {
      day: "Day name in brackets [ Pondelok ]",
      meals: [
        {
          name: "Meal name in bold **Raňajky (XXX kcal):**",
          description: "Stručný a profesionálny popis jedla",
          approx_calories: "Calories (XXX kcal)"
        }
      ]
    }
  ]
};

// Mapovanie alergií na konkrétne zakázané výrazy
const ALLERGY_MAP: Record<string, string[]> = {
  "orechy": ["mandle", "orech", "lieskov", "vlašsk", "arašid", "kešu", "pistáci", "para orech", "pekanov"],
  "ryby": ["ryba", "ryby", "losos", "tuniak", "pstruh", "treska", "makrela", "zubáč", "kapor", "pražma", "morské plody", "krevety"],
  "cibuľa": ["cibuľa", "cibuľka", "jarná cibuľka", "šalotka"],
  "mlieko": ["mlieko", "smotana", "tvaroh", "jogurt", "syr", "maslo", "srvátka", "laktóza"],
  "lepok": ["pšenica", "raž", "jačmeň", "ovos", "lepok", "múka", "pečivo", "chlieb", "cestoviny"],
  "vajíčka": ["vajce", "vajíčko", "žĺtok", "bielok"],
  "sója": ["sója", "sójov", "tofu", "tempeh", "edamame"]
};

function getForbiddenWords(allergens: string | null): string[] {
  const words: string[] = ["rýže", "ketchup", "metabolismus", "respektuje", "kuře", "ak toleruje", "štrúdľa", "koláč", "sladkosť"];
  if (!allergens) return words;
  
  const userAllergens = allergens.toLowerCase().split(",").map(a => a.trim());
  
  for (const allergen of userAllergens) {
    // Pridať samotný alergén
    words.push(allergen);
    
    // Pridať podkategórie z mapy
    for (const [key, subWords] of Object.entries(ALLERGY_MAP)) {
      if (allergen.includes(key)) {
        words.push(...subWords);
      }
    }
  }
  
  return Array.from(new Set(words));
}

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

  let aiJson = null;
  let systemPrompt = "";
  let userPrompt = "";

  try {
    const openai = new OpenAI({
      apiKey: process.env.NOVITA_API_KEY,
      baseURL: process.env.NOVITA_BASE_URL || "https://api.novita.ai/openai",
    });

    const model = process.env.NOVITA_MODEL || "qwen/qwen3.5-35b-a3b";

    systemPrompt = `Si profesionálny výživový poradca. Tvoj cieľ je vytvoriť jedálniček pre klienta, ktorý je 100% bezpečný vzhľadom na alergie a v perfektnej spisovnej slovenčine.

PRAVIDLÁ:
- Používaj výhradne spisovnú slovenčinu. Žiadne čechizmy (rýže, kuře, metabolismus, respektuje) ani preklepy.
- Štýl: stručný, profesionálny, bez zbytočných viet a AI poznámok.
- Jedlá: jednoduché, realistické, vhodné pre cieľ: ${mealPlanRequest.goal}.
- ZAKÁZANÉ: koláče, štrúdle, sladkosti (ak je cieľom chudnutie).

ALERGIE (KRITICKÉ):
- Nikdy nepouži potraviny, na ktoré má klient alergiu: ${mealPlanRequest.allergens || "Žiadne"}.
- NESMIEŠ použiť ani podkategórie (napr. ak je alergia na orechy, nepouži mandle, arašidy atď.).
- Nikdy ich nespomínaj vo výstupe ani ich nenahrádzaj rizikovými alternatívami.

FORMÁT (DODRŽIAVAJ PRESNE):
ZHRNUTIE KLIENTA: (max 2 vety)
CIEĽ: (stručne)
KALÓRIE A MAKROŽIVINY:
**Kalórie:** XXXX kcal
**Bielkoviny:** XXX g
**Sacharidy:** XXX g
**Tuky:** XXX g

ODPORÚČANIA: (max 5 bodov)

JEDÁLNIČEK:
[ Pondelok ]
**Raňajky (XXX kcal):** stručný popis
**Desiata (XXX kcal):** stručný popis
**Obed (XXX kcal):** stručný popis
**Olovrant (XXX kcal):** stručný popis
**Večera (XXX kcal):** stručný popis

(Každý deň oddel prázdnym riadkom)

POUŽI FORMÁT JSON podľa tejto štruktúry: ${JSON.stringify(MEAL_PLAN_STRUCTURE, null, 2)}`;

    userPrompt = `Prosím o vygenerovanie profesionálneho jedálnička:
- Cieľ: ${mealPlanRequest.goal}
- Výška: ${mealPlanRequest.height_cm} cm, Vek: ${mealPlanRequest.age}, Pohlavie: ${mealPlanRequest.gender === "male" ? "Muž" : "Žena"}
- Alergie: ${mealPlanRequest.allergens || "Žiadne"}
- Obľúbené jedlá: ${mealPlanRequest.favorite_foods || "Žiadne"}
- Poznámky od trénera: ${trainerNotes || "Žiadne"}`;

    const forbiddenWords = getForbiddenWords(mealPlanRequest.allergens);
    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
      attempts++;
      const completion = await openai.chat.completions.create({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" }
      });

      let aiContent = completion.choices[0].message.content;

      // Proofreader
      if (aiContent) {
        try {
          const proofreadCompletion = await openai.chat.completions.create({
            model: model,
            messages: [
              { role: "system", content: "Si expert na slovenský jazyk. Oprav gramatiku, odstráň čechizmy a zachovaj profesionálny štýl a JSON štruktúru. NIKDY nepridávaj komentáre." },
              { role: "user", content: `Oprav tento JSON text (markdown formátovanie a štýl zachovaj): ${aiContent}` }
            ],
            response_format: { type: "json_object" }
          });
          if (proofreadCompletion.choices[0].message.content) {
            aiContent = proofreadCompletion.choices[0].message.content;
          }
        } catch (proofError) {
          console.error("[AI Proofreader] Error, continuing with original content:", proofError);
        }
      }

      if (aiContent) {
        try {
          const tempJson = JSON.parse(aiContent);
          const rawString = JSON.stringify(tempJson).toLowerCase();
          
          // Validácia alergií a čechizmov
          const foundForbidden = forbiddenWords.filter(word => rawString.includes(word.toLowerCase()));
          
          if (foundForbidden.length === 0) {
            aiJson = tempJson;
            break; // Úspech
          } else {
            console.warn(`[AI Generate] Attempt ${attempts} failed. Forbidden words: ${foundForbidden.join(", ")}`);
            if (attempts === maxAttempts) {
              // Ak zlyhá aj posledný pokus, skúsime aspoň post-processing pre bežné chyby
              let processedStr = JSON.stringify(tempJson);
              processedStr = processedStr.replace(/rýže/gi, "ryža").replace(/metabolismus/gi, "metabolizmus").replace(/kuře/gi, "kuracie");
              aiJson = JSON.parse(processedStr);
            }
          }
        } catch (e) {
          console.error("[AI Generate] JSON error:", e);
        }
      }
    }

    if (!aiJson) {
      throw new Error("Nepodarilo sa vygenerovať validný jedálniček bez zakázaných slov.");
    }
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

  // Save AI draft to DB
  await supabase
    .from("meal_plan_requests")
    .update({
      ai_generation_status: "ready",
      ai_generated_plan: aiJson,
      ai_prompt_input: {
        system_prompt: systemPrompt,
        user_prompt: userPrompt,
        trainer_notes: trainerNotes
      },
      ai_generated_at: new Date().toISOString()
    })
    .eq("id", mealPlanRequestId);

  return NextResponse.json({
    status: "ready",
    data: aiJson
  });
}
