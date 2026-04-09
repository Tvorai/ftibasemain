/**
 * Safely parses AI output that is expected to be JSON.
 * If the output is valid JSON, it returns an object with format: "structured".
 * If the output is not valid JSON, it returns an object with format: "text" and the original content.
 */
export function safeParseAiJson(content: string | null): any {
  if (!content) {
    return {
      format: "text",
      raw_text: ""
    };
  }

  // Trim whitespace
  const trimmed = content.trim();

  // Try to find JSON block in markdown if it exists (```json ... ```)
  let jsonToParse = trimmed;
  const jsonMatch = trimmed.match(/```json\s*([\s\S]*?)\s*```/i);
  if (jsonMatch && jsonMatch[1]) {
    jsonToParse = jsonMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonToParse);
    
    // If it's already structured, wrap it or return as is with format "structured"
    if (typeof parsed === "object" && parsed !== null) {
      return {
        format: "structured",
        ...parsed
      };
    }
    
    // Fallback if parsed isn't an object
    return {
      format: "text",
      raw_text: trimmed
    };
  } catch (e) {
    // If JSON parsing fails, return as text
    return {
      format: "text",
      raw_text: trimmed
    };
  }
}
