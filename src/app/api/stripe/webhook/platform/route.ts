// Fitbase Platform Webhook - v1.0.1
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, getEmailTemplateHtml } from "@/lib/email/emailService";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getStringField(obj: Record<string, unknown>, key: string): string | null {
  const value = obj[key];
  return typeof value === "string" && value.trim() ? value : null;
}

export async function POST(request: Request) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!stripeSecretKey || !webhookSecret) {
    return NextResponse.json({ message: "Chýba Stripe konfigurácia." }, { status: 500 });
  }
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ message: "Chýba Supabase konfigurácia." }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ message: "Chýba stripe-signature." }, { status: 400 });
  }

  const rawBody = Buffer.from(await request.arrayBuffer());
  const stripe = new Stripe(stripeSecretKey);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ message }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const meta: Record<string, unknown> = isRecord(session.metadata) ? session.metadata : {};
    
    const type = getStringField(meta, "type") || getStringField(meta, "service_type");
    const stripePaymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;

    if (type === "meal_plan") {
      // FLOW PRE JEDALNICEK
      const trainerId = getStringField(meta, "trainer_id");
      const userId = getStringField(meta, "user_id");
      const clientName = getStringField(meta, "client_name");
      const clientEmail = getStringField(meta, "client_email");
      const clientPhone = getStringField(meta, "client_phone");
      const goal = getStringField(meta, "goal");
      const heightCm = getStringField(meta, "height_cm");
      const age = getStringField(meta, "age");
      const gender = getStringField(meta, "gender");
      const allergens = getStringField(meta, "allergens");
      const favoriteFoods = getStringField(meta, "favorite_foods");
      const priceCentsRaw = getStringField(meta, "price_cents");
      const amountTotal = typeof session.amount_total === "number" ? session.amount_total : null;
      const priceCents = amountTotal || (priceCentsRaw ? Number(priceCentsRaw) : null);
      
      const originalPriceCentsRaw = getStringField(meta, "original_price_cents");
      const originalPriceCents = originalPriceCentsRaw ? Number(originalPriceCentsRaw) : priceCents;
      const finalPriceCents = priceCents;
      const discountCode = getStringField(meta, "discount_code");
      const discountAmountRaw = getStringField(meta, "discount_amount_cents");
      const discountAmountCents = discountAmountRaw ? Number(discountAmountRaw) : 0;

      // Idempotencia - skontrolovať či už existuje meal plan s touto session
      const { data: existingMealPlan } = await supabase
        .from("meal_plan_requests")
        .select("id")
        .eq("stripe_checkout_session_id", session.id)
        .maybeSingle();

      if (existingMealPlan) {
        return NextResponse.json({ received: true, action: "none", message: "Meal plan already exists" });
      }

      const insertPayload: Record<string, unknown> = {
        trainer_id: trainerId,
        client_profile_id: userId,
        name: clientName,
        email: clientEmail,
        phone: clientPhone,
        goal: goal,
        height_cm: heightCm ? Number(heightCm) : null,
        age: age ? Number(age) : null,
        gender: gender,
        allergens: allergens,
        favorite_foods: favoriteFoods,
        status: "confirmed",
        payment_status: "paid",
        price_cents: priceCents,
        discount_code: discountCode,
        discount_amount_cents: discountAmountCents,
        currency: "eur",
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: stripePaymentIntentId,
      };

      const { data: inserted, error: insertErr } = await supabase
        .from("meal_plan_requests")
        .insert(insertPayload)
        .select("id")
        .maybeSingle();

      if (insertErr) {
        console.error("[Platform Webhook] Error inserting meal plan:", insertErr.message);
        return NextResponse.json({ message: insertErr.message }, { status: 500 });
      }

      // ODOVZDANIE EMAILU KLIENTOVI (Meal Plan)
      if (clientEmail) {
        const sender = "Fitbase <noreply@fitbase.sk>";
        console.log(`[EMAIL FLOW] source=webhook event=checkout.session.completed service_type=meal_plan to=${clientEmail} subject="Potvrdenie platby - Fitbase"`);
        try {
          // Získať meno trénera
          const { data: trainer, error: trainerErr } = await supabase
            .from("trainers")
            .select("full_name")
            .eq("id", trainerId)
            .maybeSingle();
          
          if (trainerErr) {
            console.error(`[EMAIL FLOW] DB Error fetching trainer name: ${trainerErr.message}`);
          }
          
          const trainerName = trainer?.full_name || "Váš tréner";
          const priceStr = priceCents ? `${(priceCents / 100).toFixed(2)} €` : "neuvedená";

          const html = getEmailTemplateHtml({
            title: "Potvrdenie platby - Jedálniček",
            clientName: clientName || "zákazník",
            serviceName: "Jedálniček na mieru",
            trainerName,
            price: priceStr,
            content: "Vaša platba za jedálniček na mieru bola úspešne prijatá. Tréner začne na Vašom jedálničku pracovať."
          });

          const emailResult = await sendEmail({
            to: clientEmail,
            subject: "Potvrdenie platby - Fitbase",
            html
          });
          console.log(`[EMAIL FLOW] result=${emailResult.success ? 'SUCCESS' : 'FAILED'} recipient=${clientEmail}`);
          if (!emailResult.success) {
            console.error(`[EMAIL FLOW] Resend error details:`, emailResult.error, emailResult.data);
          }
        } catch (emailErr: unknown) {
          console.error("[EMAIL FLOW] Exception during meal plan email:", emailErr instanceof Error ? emailErr.stack : emailErr);
        }
      } else {
        console.warn("[EMAIL FLOW] Skip email (meal_plan): clientEmail is undefined/null");
      }

      // Inkrementovať used_count ak bol použitý kód
      if (discountCode && trainerId) {
        console.log(`[Platform Webhook] Attempting discount increment for code: ${discountCode}, trainer: ${trainerId}`);
        
        // 1. Skúsime RPC (atomické a bezpečné)
        const { error: rpcErr } = await supabase.rpc("increment_discount_usage", { 
          t_id: trainerId, 
          d_code: discountCode 
        });

        if (rpcErr) {
          console.warn("[Platform Webhook] RPC increment failed, trying direct update:", rpcErr.message);
          
          // 2. Fallback: Priamy update ak RPC neexistuje alebo zlyhá
          // Najprv zistíme aktuálny stav
          const { data: discount } = await supabase
            .from("trainer_discounts")
            .select("id, used_count, max_uses")
            .eq("trainer_id", trainerId)
            .eq("code", discountCode)
            .maybeSingle();

          if (discount) {
            const canIncrement = !discount.max_uses || discount.used_count < discount.max_uses;
            if (canIncrement) {
              const { error: updateErr } = await supabase
                .from("trainer_discounts")
                .update({ used_count: (discount.used_count || 0) + 1 })
                .eq("id", discount.id);
              
              if (updateErr) {
                console.error("[Platform Webhook] Direct discount update failed:", updateErr.message);
              } else {
                console.log("[Platform Webhook] Discount incremented via direct update.");
              }
            } else {
              console.warn("[Platform Webhook] Discount max_uses reached, skipping increment.");
            }
          } else {
            console.error("[Platform Webhook] Discount code not found for direct update.");
          }
        } else {
          console.log("[Platform Webhook] Discount incremented via RPC.");
        }
      }

      return NextResponse.json({ received: true, action: "inserted_meal_plan", id: inserted?.id });
    }

    if (type === "transformation") {
      // FLOW PRE MESAČNÚ PREMENU
      const trainerId = getStringField(meta, "trainer_id");
      const userId = getStringField(meta, "user_id");
      const clientName = getStringField(meta, "client_name");
      const clientEmail = getStringField(meta, "client_email");
      const clientPhone = getStringField(meta, "client_phone");
      const note = getStringField(meta, "note");
      const priceCentsRaw = getStringField(meta, "price_cents");
      const amountTotal = typeof session.amount_total === "number" ? session.amount_total : null;
      const priceCents = amountTotal || (priceCentsRaw ? Number(priceCentsRaw) : null);
      
      const originalPriceCentsRaw = getStringField(meta, "original_price_cents");
      const originalPriceCents = originalPriceCentsRaw ? Number(originalPriceCentsRaw) : priceCents;
      const finalPriceCents = priceCents;

      const discountCode = getStringField(meta, "discount_code");
      const discountAmountRaw = getStringField(meta, "discount_amount_cents");
      const discountAmountCents = discountAmountRaw ? Number(discountAmountRaw) : 0;
      
      const personalSessionsCount = getStringField(meta, "personal_sessions_count");
      const onlineCallsCount = getStringField(meta, "online_calls_count");
      const includesMealPlan = getStringField(meta, "includes_meal_plan") === "true";

      const now = new Date();
      const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      console.log("[Platform Webhook] Attempting transformation insert:", { trainerId, userId, session: session.id });

      // Idempotencia
      const { data: existingBooking } = await supabase
        .from("bookings")
        .select("id")
        .eq("stripe_checkout_session_id", session.id)
        .maybeSingle();

      if (existingBooking) {
        console.log("[Platform Webhook] Transformation already exists:", existingBooking.id);
        return NextResponse.json({ received: true, action: "none", message: "Transformation booking already exists" });
      }

      const clientNote = note || (personalSessionsCount ? `Program: ${personalSessionsCount}x tréning, ${onlineCallsCount}x volanie, Jedálniček: ${includesMealPlan ? 'ÁNO' : 'NIE'}` : null);

      const insertPayload: Record<string, unknown> = {
        trainer_id: trainerId,
        client_profile_id: userId,
        client_name: clientName,
        client_email: clientEmail,
        client_phone: clientPhone,
        client_note: clientNote,
        starts_at: now.toISOString(),
        ends_at: end.toISOString(),
        booking_status: "confirmed",
        payment_status: "paid",
        service_type: "transformation",
        price_cents: priceCents,
        discount_code: discountCode,
        discount_amount_cents: discountAmountCents,
        currency: "eur",
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: stripePaymentIntentId,
      };

      const { data: inserted, error: insertErr } = await supabase
        .from("bookings")
        .insert(insertPayload)
        .select("id")
        .maybeSingle();

      if (insertErr) {
        console.error("[Platform Webhook] Error inserting transformation booking:", insertErr.message, insertErr);
        // Fallback pre prípad chýbajúcich stĺpcov
        const fallbackPayload: Record<string, unknown> = {
          trainer_id: trainerId,
          client_profile_id: userId,
          client_name: clientName,
          client_email: clientEmail,
          client_phone: clientPhone,
          note: clientNote, // Používame 'note' namiesto 'client_note'
          starts_at: now.toISOString(),
          ends_at: end.toISOString(),
          booking_status: "confirmed",
          payment_status: "paid",
          service_type: "transformation",
          price_cents: priceCents,
          discount_code: discountCode,
          discount_amount_cents: discountAmountCents,
          currency: "eur",
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id: stripePaymentIntentId,
        };
        const { data: retryInserted, error: retryErr } = await supabase
          .from("bookings")
          .insert(fallbackPayload)
          .select("id")
          .maybeSingle();
        
        if (retryErr) {
          console.error("[Platform Webhook] Fallback insert failed:", retryErr.message, retryErr);
          return NextResponse.json({ message: retryErr.message }, { status: 500 });
        }
        console.log("[Platform Webhook] Transformation inserted via fallback:", retryInserted?.id);
        return NextResponse.json({ received: true, action: "inserted_transformation_fallback", id: retryInserted?.id });
      }

      console.log("[Platform Webhook] Transformation inserted successfully:", inserted?.id);

      // ODOVZDANIE EMAILU KLIENTOVI (Transformation)
      if (clientEmail) {
        const sender = "Fitbase <noreply@fitbase.sk>";
        console.log(`[EMAIL FLOW] source=webhook event=checkout.session.completed service_type=transformation to=${clientEmail} subject="Potvrdenie platby - Fitbase"`);
        try {
          const { data: trainer, error: trainerErr } = await supabase
            .from("trainers")
            .select("full_name")
            .eq("id", trainerId)
            .maybeSingle();
          
          if (trainerErr) {
            console.error(`[EMAIL FLOW] DB Error fetching trainer name: ${trainerErr.message}`);
          }
          
          const trainerName = trainer?.full_name || "Váš tréner";
          const priceStr = priceCents ? `${(priceCents / 100).toFixed(2)} €` : "neuvedená";

          const html = getEmailTemplateHtml({
            title: "Potvrdenie platby - Mesačná premena",
            clientName: clientName || "zákazník",
            serviceName: "Mesačná premena",
            trainerName,
            price: priceStr,
            content: "Vaša platba za program Mesačná premena bola úspešne prijatá. Tréner Vás bude čoskoro kontaktovať."
          });

          const emailResult = await sendEmail({
            to: clientEmail,
            subject: "Potvrdenie platby - Fitbase",
            html
          });
          console.log(`[EMAIL FLOW] result=${emailResult.success ? 'SUCCESS' : 'FAILED'} recipient=${clientEmail}`);
          if (!emailResult.success) {
            console.error(`[EMAIL FLOW] Resend error details:`, emailResult.error, emailResult.data);
          }
        } catch (emailErr: unknown) {
          console.error("[EMAIL FLOW] Exception during transformation email:", emailErr instanceof Error ? emailErr.stack : emailErr);
        }
      } else {
        console.warn("[EMAIL FLOW] Skip email (transformation): clientEmail is undefined/null");
      }

      // Inkrementovať used_count ak bol použitý kód
      if (discountCode && trainerId) {
        console.log(`[Platform Webhook] Attempting discount increment for code: ${discountCode}, trainer: ${trainerId}`);
        
        const { error: rpcErr } = await supabase.rpc("increment_discount_usage", { 
          t_id: trainerId, 
          d_code: discountCode 
        });

        if (rpcErr) {
          console.warn("[Platform Webhook] RPC increment failed, trying direct update:", rpcErr.message);
          
          const { data: discount } = await supabase
            .from("trainer_discounts")
            .select("id, used_count, max_uses")
            .eq("trainer_id", trainerId)
            .eq("code", discountCode)
            .maybeSingle();

          if (discount) {
            const canIncrement = !discount.max_uses || discount.used_count < discount.max_uses;
            if (canIncrement) {
              const { error: updateErr } = await supabase
                .from("trainer_discounts")
                .update({ used_count: (discount.used_count || 0) + 1 })
                .eq("id", discount.id);
              
              if (updateErr) {
                console.error("[Platform Webhook] Direct discount update failed:", updateErr.message);
              } else {
                console.log("[Platform Webhook] Discount incremented via direct update.");
              }
            }
          }
        } else {
          console.log("[Platform Webhook] Discount incremented via RPC.");
        }
      }

      return NextResponse.json({ received: true, action: "inserted_transformation", id: inserted?.id });
    }

    // POVODNY FLOW PRE BOOKINGY
    const bookingIdFromMeta = getStringField(meta, "booking_id");
    const trainerId = getStringField(meta, "trainer_id");
    const userId = getStringField(meta, "user_id");
    const startsAt = getStringField(meta, "starts_at");
    const endsAt = getStringField(meta, "ends_at");

    // 1. Skúsime nájsť existujúci booking podľa session.id alebo bookingIdFromMeta
    let existingBookingId: string | null = null;
    
    const { data: existingBySession } = await supabase
      .from("bookings")
      .select("id")
      .eq("stripe_checkout_session_id", session.id)
      .maybeSingle<{ id: string }>();
    
    if (existingBySession?.id) {
      existingBookingId = existingBySession.id;
    } else if (bookingIdFromMeta) {
      const { data: existingByMetaId } = await supabase
        .from("bookings")
        .select("id")
        .eq("id", bookingIdFromMeta)
        .maybeSingle<{ id: string }>();
      if (existingByMetaId?.id) {
        existingBookingId = existingByMetaId.id;
      }
    }

    if (existingBookingId) {
      // Update existujúceho bookingu
      const { error: updateErr } = await supabase
        .from("bookings")
        .update({
          booking_status: "confirmed",
          payment_status: "paid",
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id: stripePaymentIntentId,
        })
        .eq("id", existingBookingId);
      
      if (updateErr) {
        console.error("[Platform Webhook] Error updating booking:", updateErr.message);
        return NextResponse.json({ message: updateErr.message }, { status: 500 });
      }

      // ODOVZDANIE EMAILU KLIENTOVI (Booking Update)
      const clientEmail = getStringField(meta, "client_email");
      const clientName = getStringField(meta, "client_name");
      const priceCentsRaw = getStringField(meta, "price_cents");
      const amountTotal = typeof session.amount_total === "number" ? session.amount_total : null;
      const priceCents = amountTotal || (priceCentsRaw ? Number(priceCentsRaw) : null);
      const trainerIdFromMeta = getStringField(meta, "trainer_id");
      
      if (clientEmail && trainerIdFromMeta) {
        const sender = "Fitbase <noreply@fitbase.sk>";
        console.log(`[EMAIL FLOW] source=webhook event=checkout.session.completed service_type=booking_update to=${clientEmail} subject="Potvrdenie platby - Fitbase"`);
        try {
          const { data: trainer, error: trainerErr } = await supabase
            .from("trainers")
            .select("full_name")
            .eq("id", trainerIdFromMeta)
            .maybeSingle();
          
          if (trainerErr) {
            console.error(`[EMAIL FLOW] DB Error fetching trainer name: ${trainerErr.message}`);
          }
          
          const trainerName = trainer?.full_name || "Váš tréner";
          const priceStr = priceCents ? `${(priceCents / 100).toFixed(2)} €` : "neuvedená";

          const html = getEmailTemplateHtml({
            title: "Potvrdenie platby - Tréning",
            clientName: clientName || "zákazník",
            serviceName: "Osobný tréning / Konzultácia",
            trainerName,
            price: priceStr,
            content: "Vaša platba za rezerváciu bola úspešne prijatá. Termín je potvrdený."
          });

          const emailResult = await sendEmail({
            to: clientEmail,
            subject: "Potvrdenie platby - Fitbase",
            html
          });
          console.log(`[EMAIL FLOW] result=${emailResult.success ? 'SUCCESS' : 'FAILED'} recipient=${clientEmail}`);
          if (!emailResult.success) {
            console.error(`[EMAIL FLOW] Resend error details:`, emailResult.error, emailResult.data);
          }
        } catch (emailErr: unknown) {
          console.error("[EMAIL FLOW] Exception during booking update email:", emailErr instanceof Error ? emailErr.stack : emailErr);
        }
      } else {
        console.warn(`[EMAIL FLOW] Skip email (booking_update): clientEmail=${clientEmail}, trainerId=${trainerIdFromMeta}`);
      }

      // Inkrementovať used_count ak bol použitý kód pri update existujúceho bookingu
      const discountCode = getStringField(meta, "discount_code");
      const trainerId = getStringField(meta, "trainer_id");
      if (discountCode && trainerId) {
        console.log(`[Platform Webhook] Attempting discount increment for code: ${discountCode}, trainer: ${trainerId} (Update Flow)`);
        
        const { error: rpcErr } = await supabase.rpc("increment_discount_usage", { 
          t_id: trainerId, 
          d_code: discountCode 
        });

        if (rpcErr) {
          console.warn("[Platform Webhook] RPC increment failed (Update Flow), trying direct update:", rpcErr.message);
          
          const { data: discount } = await supabase
            .from("trainer_discounts")
            .select("id, used_count, max_uses")
            .eq("trainer_id", trainerId)
            .eq("code", discountCode)
            .maybeSingle();

          if (discount) {
            const canIncrement = !discount.max_uses || discount.used_count < discount.max_uses;
            if (canIncrement) {
              const { error: updateErr } = await supabase
                .from("trainer_discounts")
                .update({ used_count: (discount.used_count || 0) + 1 })
                .eq("id", discount.id);
              
              if (updateErr) {
                console.error("[Platform Webhook] Direct discount update failed (Update Flow):", updateErr.message);
              } else {
                console.log("[Platform Webhook] Discount incremented via direct update (Update Flow).");
              }
            }
          }
        } else {
          console.log("[Platform Webhook] Discount incremented via RPC (Update Flow).");
        }
      }

      return NextResponse.json({ received: true, action: "updated", booking_id: existingBookingId });
    } else {
      // Vytvorenie nového bookingu (pre flow z create-checkout, kde booking ešte nie je v DB)
      if (!trainerId || !userId || !startsAt || !endsAt || !type) {
        console.warn("[Platform Webhook] Missing metadata for new booking creation");
        return NextResponse.json({ message: "Chýbajú povinné metadata pre vytvorenie bookingu." }, { status: 400 });
      }

      const clientName = getStringField(meta, "client_name");
      const clientEmailFromMeta = getStringField(meta, "client_email");
      const clientPhone = getStringField(meta, "client_phone");
      const note = getStringField(meta, "note");

      const sessionEmail = session.customer_details?.email || null;
      const clientEmail = clientEmailFromMeta || sessionEmail || null;

      const currency = typeof session.currency === "string" ? session.currency.toLowerCase() : "eur";
      const amountTotal = typeof session.amount_total === "number" ? session.amount_total : null;
      const priceCentsRaw = getStringField(meta, "price_cents");
      const priceCentsFromMeta = priceCentsRaw ? Number(priceCentsRaw) : null;
      const priceCents = amountTotal || priceCentsFromMeta || null;

      const originalPriceCentsRaw = getStringField(meta, "original_price_cents");
      const originalPriceCents = originalPriceCentsRaw ? Number(originalPriceCentsRaw) : priceCents;
      const finalPriceCents = priceCents;

      const discountCode = getStringField(meta, "discount_code");
      const discountAmountRaw = getStringField(meta, "discount_amount_cents");
      const discountAmountCents = discountAmountRaw ? Number(discountAmountRaw) : 0;

      const insertPayload: Record<string, unknown> = {
        trainer_id: trainerId,
        client_profile_id: userId,
        starts_at: startsAt,
        ends_at: endsAt,
        booking_status: "confirmed",
        payment_status: "paid",
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: stripePaymentIntentId,
        service_type: type,
        currency,
        discount_code: discountCode,
        discount_amount_cents: discountAmountCents,
      };
      if (priceCents !== null) insertPayload.price_cents = priceCents;
      if (clientName) insertPayload.client_name = clientName;
      if (clientEmail) insertPayload.client_email = clientEmail;
      if (clientPhone) insertPayload.client_phone = clientPhone;
      if (note) insertPayload.client_note = note;

      const { data: inserted, error: insertErr } = await supabase
        .from("bookings")
        .insert(insertPayload)
        .select("id")
        .maybeSingle<{ id: string }>();
      
      if (insertErr) {
        console.error("[Platform Webhook] Error inserting booking:", insertErr.message);
        // Fallback pre prípad chýbajúcich stĺpcov
        if (insertErr.message.toLowerCase().includes("column")) {
          const fallbackPayload: Record<string, unknown> = {
            trainer_id: trainerId,
            client_profile_id: userId,
            starts_at: startsAt,
            ends_at: endsAt,
            booking_status: "confirmed",
            payment_status: "paid",
            stripe_checkout_session_id: session.id,
            stripe_payment_intent_id: stripePaymentIntentId,
            service_type: type,
            currency,
            discount_code: discountCode,
            discount_amount_cents: discountAmountCents,
          };
          if (priceCents !== null) fallbackPayload.price_cents = priceCents;
          if (clientName) fallbackPayload.client_name = clientName;
          if (clientEmail) fallbackPayload.client_email = clientEmail;
          if (clientPhone) fallbackPayload.client_phone = clientPhone;
          if (note) fallbackPayload.note = note;
          const { data: retryInserted, error: retryErr } = await supabase
            .from("bookings")
            .insert(fallbackPayload)
            .select("id")
            .maybeSingle();
          if (retryErr) {
            console.error("[Platform Webhook] Fallback insert failed:", retryErr.message);
            return NextResponse.json({ message: retryErr.message }, { status: 500 });
          }
          return NextResponse.json({ received: true, action: "inserted_fallback", id: retryInserted?.id });
        }
        return NextResponse.json({ message: insertErr.message }, { status: 500 });
      }

      // Inkrementovať used_count ak bol použitý kód
      if (discountCode && trainerId) {
        console.log(`[Platform Webhook] Attempting discount increment for code: ${discountCode}, trainer: ${trainerId}`);
        
        const { error: rpcErr } = await supabase.rpc("increment_discount_usage", { 
          t_id: trainerId, 
          d_code: discountCode 
        });

        if (rpcErr) {
          console.warn("[Platform Webhook] RPC increment failed, trying direct update:", rpcErr.message);
          
          const { data: discount } = await supabase
            .from("trainer_discounts")
            .select("id, used_count, max_uses")
            .eq("trainer_id", trainerId)
            .eq("code", discountCode)
            .maybeSingle();

          if (discount) {
            const canIncrement = !discount.max_uses || discount.used_count < discount.max_uses;
            if (canIncrement) {
              const { error: updateErr } = await supabase
                .from("trainer_discounts")
                .update({ used_count: (discount.used_count || 0) + 1 })
                .eq("id", discount.id);
              
              if (updateErr) {
                console.error("[Platform Webhook] Direct discount update failed:", updateErr.message);
              } else {
                console.log("[Platform Webhook] Discount incremented via direct update.");
              }
            }
          }
        } else {
          console.log("[Platform Webhook] Discount incremented via RPC.");
        }
      }

      return NextResponse.json({ received: true, action: "inserted", booking_id: inserted?.id });
    }
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;
    const meta: Record<string, unknown> = isRecord(pi.metadata) ? pi.metadata : {};
    const type = getStringField(meta, "type");

    if (type === "meal_plan") {
      // Potvrdenie platby pre meal plan ak by náhodou checkout session zlyhala
      // Alebo ak sa používa oddelený flow
      const { error: updateErr } = await supabase
        .from("meal_plan_requests")
        .update({
          payment_status: "paid",
          stripe_payment_intent_id: pi.id,
        })
        .eq("stripe_payment_intent_id", pi.id) // Alebo iný link ak existuje
        .is("payment_status", "unpaid");
      
      if (updateErr) {
        console.error("[Platform Webhook] Error updating meal plan PI status:", updateErr.message);
      }
      return NextResponse.json({ received: true, type: "payment_intent.succeeded_meal_plan" });
    }

    const bookingIdFromMeta = getStringField(meta, "booking_id");

    if (bookingIdFromMeta) {
      const { error: updateErr } = await supabase
        .from("bookings")
        .update({
          payment_status: "paid",
          stripe_payment_intent_id: pi.id,
        })
        .eq("id", bookingIdFromMeta)
        // Ak už je confirmed, neprepisujeme ho (mohlo by byť už completed)
        .is("payment_status", "unpaid");
      
      if (updateErr) {
        console.error("[Platform Webhook] Error updating PI status:", updateErr.message);
      }
    }
    return NextResponse.json({ received: true, type: "payment_intent.succeeded" });
  }

  return NextResponse.json({ received: true });
}
