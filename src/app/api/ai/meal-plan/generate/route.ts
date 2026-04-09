import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

// Define the expected output structure for the AI
const MEAL_PLAN_STRUCTURE = {
  client_summary: "Brief summary of the client and their needs",
  goal_summary: "Detailed explanation of how the plan meets the user's goal",
  calorie_target: "Estimated daily calorie target",
  macros: {
    protein: "Protein target in grams",
    carbs: "Carbs target in grams",
    fats: "Fats target in grams"
  },
  recommendations: [
    "List of general health and nutrition recommendations"
  ],
  meal_plan_days: [
    {
      day: "Day name (e.g. Pondelok)",
      meals: [
        {
          name: "Meal name (e.g. Raňajky)",
          description: "Meal description and ingredients",
          approx_calories: "Calories for this meal"
        }
      ]
    }
  ]
};

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

    const systemPrompt = `Si špičkový nutričný poradca a asistent pre osobných trénerov. Tvojou úlohou je vygenerovať draft (návrh) jedálnička pre klienta na základe jeho údajov. 
Tento draft bude následne upravovať tréner, takže buď profesionálny, presný a zameraj sa na praktické odporúčania.
VÝSTUP MUSÍ BYŤ V SLOVENČINE.
POUŽI FORMÁT JSON podľa tejto štruktúry: ${JSON.stringify(MEAL_PLAN_STRUCTURE, null, 2)}`;

    const userPrompt = `Prosím o vygenerovanie draftu jedálnička pre klienta s týmito parametrami:
- Cieľ: ${mealPlanRequest.goal}
- Výška: ${mealPlanRequest.height_cm} cm
- Vek: ${mealPlanRequest.age} rokov
- Pohlavie: ${mealPlanRequest.gender === "male" ? "Muž" : "Žena"}
- Alergény: ${mealPlanRequest.allergens || "Žiadne"}
- Obľúbené jedlá: ${mealPlanRequest.favorite_foods || "Žiadne"}
- Poznámky od trénera: ${trainerNotes || "Žiadne"}`;

    const completion = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" }
    });

    const aiContent = completion.choices[0].message.content;
    let aiJson = null;

    try {
      aiJson = aiContent ? JSON.parse(aiContent) : null;
    } catch (parseError) {
      console.error("[AI Generate] JSON parse error:", parseError);
      // Fallback: store as raw text if JSON parsing fails
      aiJson = { raw_text: aiContent };
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
