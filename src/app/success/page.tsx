import Link from "next/link";
import { Container } from "@/components/Container";

export default function SuccessPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const bookingIdRaw = searchParams?.booking_id;
  const bookingId = typeof bookingIdRaw === "string" ? bookingIdRaw : null;
  const sessionIdRaw = searchParams?.session_id;
  const sessionId = typeof sessionIdRaw === "string" ? sessionIdRaw : null;

  return (
    <Container className="py-12 text-white space-y-4">
      <h1 className="text-3xl font-display uppercase tracking-wider text-emerald-400">Platba úspešná</h1>
      <p className="text-zinc-300">
        Ďakujeme. Rezervácia je potvrdená po úspešnej platbe.
      </p>
      {bookingId && (
        <p className="text-xs text-zinc-500 font-mono break-all">booking_id: {bookingId}</p>
      )}
      {!bookingId && sessionId && (
        <p className="text-xs text-zinc-500 font-mono break-all">session_id: {sessionId}</p>
      )}
      <div className="pt-4">
        <Link href="/historia-rezervacii" className="text-emerald-400 hover:text-emerald-300 font-bold uppercase tracking-widest text-xs">
          Prejsť na moje rezervácie
        </Link>
      </div>
    </Container>
  );
}
