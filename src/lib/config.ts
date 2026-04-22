type AppEnv = "staging" | "production";

export const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL || 
  process.env.NEXT_PUBLIC_SITE_URL || 
  "https://fitbase.sk";

export const appEnv: AppEnv =
  (process.env.NEXT_PUBLIC_ENV === "production" || siteUrl.includes("fitbase.sk")) 
    ? "production" 
    : "staging";

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const stripeWebhookSecret =
  appEnv === "production"
    ? process.env.STRIPE_WEBHOOK_SECRET_LIVE
    : process.env.STRIPE_WEBHOOK_SECRET_TEST;

export const stripeConnectWebhookSecret =
  appEnv === "production"
    ? process.env.STRIPE_CONNECT_WEBHOOK_SECRET_LIVE
    : process.env.STRIPE_CONNECT_WEBHOOK_SECRET_TEST;

export const featureFlags = {
  supabaseEnabled: Boolean(supabaseUrl && supabaseAnonKey),
  stripeEnabled: false
};
