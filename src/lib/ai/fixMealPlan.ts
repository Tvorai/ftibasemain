import OpenAI from "openai";

/**
 * AI function that fixes the grammar and style of a generated meal plan.
 * It uses a low temperature for high consistency.
 */
export async function fixMealPlanGrammar(rawText: string): Promise<string> {
  if (!rawText) return "";

  const openai = new OpenAI({
    apiKey: process.env.NOVITA_API_KEY,
    baseURL: process.env.NOVITA_BASE_URL || "https://api.novita.ai/openai",
  });

  const model = process.env.NOVITA_MODEL || "qwen/qwen3.5-35b-a3b";

  const prompt = `Oprav nasledujúci jedálniček do čistej spisovnej slovenčiny.

PRAVIDLÁ:
- oprav gramatiku
- odstráň čechizmy
- oprav štylistiku
- zachovaj význam
- NEMEŇ potraviny
- NEMEŇ kalórie
- zachovaj formát (dni, jedlá, kcal)

Zakázané:
- meniť obsah jedál
- pridávať nové jedlá
- odstraňovať jedlá

Výstup musí pôsobiť ako profesionálny jedálniček od trénera.

Vráť iba opravený text bez komentára.

TEXT:
${rawText}`;

  try {
    const completion = await openai.chat.completions.create({
      model: model,
      messages: [
        { 
          role: "system", 
          content: "Si profesionálny editor a osobný tréner. Tvojou úlohou je opraviť gramatiku a štýl jedálnička bez zmeny jeho obsahu." 
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 4000
    });

    return completion.choices[0].message.content || rawText;
  } catch (error) {
    console.error("[fixMealPlanGrammar] error:", error);
    // Fallback to original text if AI fix fails
    return rawText;
  }
}
