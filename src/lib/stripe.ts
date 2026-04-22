import Stripe from "stripe";
import { appEnv } from "./config";

const stripeSecretKey =
  appEnv === "production"
    ? process.env.STRIPE_SECRET_KEY_LIVE
    : process.env.STRIPE_SECRET_KEY_TEST;

if (!stripeSecretKey) {
  console.warn(`STRIPE_SECRET_KEY_${appEnv === "production" ? "LIVE" : "TEST"} is not set.`);
}

export const stripe = new Stripe(stripeSecretKey || "", {
  apiVersion: "2026-03-25.dahlia" as "2026-03-25.dahlia",
});
