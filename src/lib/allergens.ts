export const ALLERGEN_MAP: Record<string, string[]> = {
  "mliečne výrobky": [
    "mlieko", "syr", "jogurt", "kefír", "tvaroh", "ricotta", "ricotta", "mozarella", "mozzarella",
    "parmezán", "smotana", "maslo", "acidofilné mlieko", "mliečny nápoj",
    "syr eidam", "bryndza", "žinčica"
  ],

  "orechy": [
    "orechy", "mandle", "lieskové orechy", "vlašské orechy", "kešu",
    "pistácie", "arašidy", "orieškové maslo", "arašidové maslo",
    "mandľové maslo", "nutella"
  ],

  "ryby": [
    "ryba", "ryby", "losos", "tuniak", "treska", "makrela", "sardinky",
    "sleď", "pstruh", "rybie filé"
  ],

  "vajcia": [
    "vajce", "vajcia", "vaječný bielok", "vaječný žĺtok", "omeleta"
  ],

  "lepok": [
    "lepok", "pšenica", "raž", "jačmeň", "špalda",
    "cestoviny", "chlieb", "pečivo", "bulgur", "krupica", "rezance"
  ],

  "sója": [
    "sója", "tofu", "sójové mlieko", "sójový proteín", "sójová omáčka"
  ],

  "paradajky": [
    "paradajka", "paradajky", "kečup", "paradajkový pretlak", "paradajková omáčka"
  ],

  "cibuľa": [
    "cibuľa", "šalotka", "jarná cibuľka", "červená cibuľa", "biela cibuľa"
  ],

  "cesnak": [
    "cesnak", "sušený cesnak", "cesnakový prášok"
  ],

  "strukoviny": [
    "šošovica", "cícer", "fazuľa", "hrach", "strukoviny"
  ],

  "semená": [
    "sezam", "chia", "ľanové semienka", "tekvicové semienka", "slnečnicové semienka", "tahini"
  ],

  "alkohol": [
    "víno", "pivo", "rum", "vodka", "alkohol"
  ],

  "cukor": [
    "cukor", "biely cukor", "hnedý cukor", "sirup", "glukóza", "fruktóza"
  ]
};

export const ALLERGEN_NORMALIZATION: Record<string, string> = {
  "syr": "mliečne výrobky",
  "mlieko": "mliečne výrobky",
  "jogurt": "mliečne výrobky",
  "tvaroh": "mliečne výrobky",

  "arašidy": "orechy",
  "mandle": "orechy",

  "paradajka": "paradajky",
  "kečup": "paradajky",

  "losos": "ryby",
  "tuniak": "ryby"
};

/**
 * Expands a list of allergens into a set of specific forbidden ingredients.
 */
export function expandAllergens(input: string[]): string[] {
  const result = new Set<string>();

  input.forEach(a => {
    const key = a.toLowerCase().trim();

    const normalized = ALLERGEN_NORMALIZATION[key] || key;

    if (ALLERGEN_MAP[normalized]) {
      ALLERGEN_MAP[normalized].forEach(item => result.add(item));
    }

    result.add(key);
  });

  return Array.from(result);
}

/**
 * Checks if a text contains any forbidden words (allergens).
 */
export function containsForbidden(text: string, allergens: string[]): boolean {
  const lower = text.toLowerCase();
  return allergens.some(word => lower.includes(word.toLowerCase()));
}
