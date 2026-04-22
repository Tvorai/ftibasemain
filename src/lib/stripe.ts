import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY_TEST;

if (!stripeSecretKey) {
  // V produkcii by toto malo vyvolať chybu, ale pri vývoji chceme vedieť čo sa deje
  console.warn("STRIPE_SECRET_KEY is not set, using empty string for now.");
}

export const stripe = new Stripe(stripeSecretKey || "", {
  apiVersion: "2026-03-25.dahlia" as "2026-03-25.dahlia", 
});
