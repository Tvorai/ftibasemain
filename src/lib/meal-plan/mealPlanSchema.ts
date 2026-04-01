import * as z from "zod";

export type MealPlanRequestFormValues = {
  name: string;
  email: string;
  phone: string;
  goal: string;
  height_cm: number;
  age: number;
  gender: "male" | "female" | "other";
  allergens?: string;
  favorite_foods?: string;
};

export const mealPlanRequestFormSchemaRaw = z.object({
  name: z.string().trim().catch(""),
  email: z.string().trim().email("Neplatný email.").or(z.literal("")).catch(""),
  phone: z.string().trim().catch(""),
  goal: z.string().trim().min(1, "Cieľ je povinný."),
  height_cm: z
    .number({ message: "Výška je povinná." })
    .int()
    .min(1, "Výška musí byť aspoň 1 cm.")
    .max(300, "Výška je príliš veľká."),
  age: z
    .number({ message: "Vek je povinný." })
    .int()
    .min(1, "Vek musí byť aspoň 1 rok.")
    .max(120, "Vek je príliš veľký."),
  gender: z.enum(["male", "female", "other"]),
  allergens: z.string().trim().optional().or(z.literal("")),
  favorite_foods: z.string().trim().optional().or(z.literal("")),
});

export const mealPlanRequestFormSchema: z.ZodType<MealPlanRequestFormValues> = mealPlanRequestFormSchemaRaw;
