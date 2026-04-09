import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { siteUrl } from "@/lib/config";

export const runtime = "nodejs";

const bodySchema = z.object({
  booking_id: z.string().uuid(),
  access_token: z.string().min(1),
});

type BookingRow = {
  id: string;
  trainer_id: string;
  client_profile_id: string | null;
  client_email: string | null;
  starts_at: string;
  ends_at: string;
  booking_status: string | null;
  payment_status: string | null;
  price_cents: number | null;
  currency: string | null;
  service_type: string | null;
  created_at: string | null;
};

type TrainerRow = {
  id: string;
  stripe_account_id: string | null;
};

function isBookableServiceType(value: unknown): value is "personal" | "online" {
  return value === "personal" || value === "online";
}

function getServiceLabel(serviceType: "personal" | "online"): string {
  return serviceType === "online" ? "Online konzultácia" : "Osobný tréning";
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ message: "Server nie je správne nakonfigurovaný." }, { status: 500 });
  }
  if (!stripeSecretKey) {
    return NextResponse.json({ message: "Chýba STRIPE_SECRET_KEY." }, { status: 500 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "Neplatné dáta." }, { status: 400 });
  }

  const { booking_id, access_token } = parsed.data;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const userRes = await supabase.auth.getUser(access_token);
  const authUser = userRes.data.user;
  if (!authUser) {
    return NextResponse.json({ message: "Neautorizované." }, { status: 401 });
  }

  const bookingRes = await supabase
    .from("bookings")
    .select("id, trainer_id, client_profile_id, client_email, starts_at, ends_at, booking_status, payment_status, price_cents, currency, service_type, created_at")
    .eq("id", booking_id)
    .maybeSingle<BookingRow>();

  if (bookingRes.error) {
    return NextResponse.json({ message: bookingRes.error.message }, { status: 500 });
  }
  if (!bookingRes.data) {
    return NextResponse.json({ message: "Booking neexistuje." }, { status: 404 });
  }

  const booking = bookingRes.data;
  if (booking.client_profile_id !== authUser.id) {
    return NextResponse.json({ message: "Nemáte oprávnenie na túto rezerváciu." }, { status: 403 });
  }

  const serviceType = isBookableServiceType(booking.service_type) ? booking.service_type : null;
  if (!serviceType) {
    return NextResponse.json({ message: "Neplatný service_type v bookingu." }, { status: 400 });
  }

  if (booking.booking_status !== "pending_payment") {
    return NextResponse.json({ message: "Booking nie je v stave pending_payment." }, { status: 409 });
  }
  if (booking.payment_status !== null && booking.payment_status !== "unpaid") {
    return NextResponse.json({ message: "Platba už prebehla alebo je v inom stave." }, { status: 409 });
  }

  const createdAt = booking.created_at ? new Date(booking.created_at) : null;
  if (createdAt) {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    if (createdAt < fifteenMinutesAgo) {
      await supabase.from("bookings").update({ booking_status: "cancelled" }).eq("id", booking.id);
      return NextResponse.json({ message: "Rezervácia expirovala. Vyberte si nový termín." }, { status: 410 });
    }
  }

  const amount = booking.price_cents;
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) {
    return NextResponse.json({ message: "Chýba alebo je neplatná cena (price_cents)." }, { status: 400 });
  }

  const currency = (booking.currency || "eur").toLowerCase();
  if (currency !== "eur") {
    return NextResponse.json({ message: "Nepodporovaná mena." }, { status: 400 });
  }

  const trainerRes = await supabase
    .from("trainers")
    .select("id, stripe_account_id")
    .eq("id", booking.trainer_id)
    .maybeSingle<TrainerRow>();

  if (trainerRes.error) {
    return NextResponse.json({ message: trainerRes.error.message }, { status: 500 });
  }
  if (!trainerRes.data?.stripe_account_id) {
    return NextResponse.json({ message: "Tréner nemá prepojený Stripe účet." }, { status: 400 });
  }

  const stripe = new Stripe(stripeSecretKey);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: amount,
          product_data: { name: getServiceLabel(serviceType) },
        },
      },
    ],
    success_url: `${siteUrl.replace(/\/$/, "")}/success?booking_id=${booking.id}`,
    cancel_url: `${siteUrl.replace(/\/$/, "")}/cancel`,
    metadata: {
      booking_id: booking.id,
      trainer_id: booking.trainer_id,
      service_type: serviceType,
    },
    payment_intent_data: {
      transfer_data: { destination: trainerRes.data.stripe_account_id },
      metadata: {
        booking_id: booking.id,
        trainer_id: booking.trainer_id,
        service_type: serviceType,
      },
    },
    customer_email: booking.client_email || undefined,
  });

  await supabase.from("bookings").update({ stripe_checkout_session_id: session.id }).eq("id", booking.id);

  if (!session.url) {
    return NextResponse.json({ message: "Stripe session.url nie je dostupné." }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
