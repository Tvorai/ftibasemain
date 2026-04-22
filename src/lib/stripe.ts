import Stripe from "stripe";
import { appEnv } from "./config";

const stripeSecretKey =
  (appEnv === "production"
    ? process.env.STRIPE_SECRET_KEY_LIVE
    : process.env.STRIPE_SECRET_KEY_TEST) || process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.error(`[STRIPE CONFIG ERROR] No secret key found for environment: ${appEnv}. Checked STRIPE_SECRET_KEY_${appEnv === "production" ? "LIVE" : "TEST"} and STRIPE_SECRET_KEY.`);
} else {
  const mode = stripeSecretKey.startsWith("sk_live") ? "LIVE" : "TEST";
  console.log(`[STRIPE CONFIG] Initialized in ${mode} mode (appEnv: ${appEnv})`);
}

export const stripe = new Stripe(stripeSecretKey || "", {
  apiVersion: "2026-03-25.dahlia" as "2026-03-25.dahlia",
});
