type AppEnv = "staging" | "production";

export const appEnv: AppEnv =
  (process.env.NEXT_PUBLIC_ENV === "production" ? "production" : "staging");

export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || (appEnv === "production" ? "https://fitbase.app" : "http://localhost:3000");

export const featureFlags = {
  supabaseEnabled: false,
  stripeEnabled: false
};
