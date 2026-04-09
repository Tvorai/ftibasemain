type AppEnv = "staging" | "production";

export const appEnv: AppEnv =
  (process.env.NEXT_PUBLIC_ENV === "production" ? "production" : "staging");

export const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL || 
  process.env.NEXT_PUBLIC_SITE_URL || 
  "https://fitbase.sk";

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const featureFlags = {
  supabaseEnabled: Boolean(supabaseUrl && supabaseAnonKey),
  stripeEnabled: false
};
