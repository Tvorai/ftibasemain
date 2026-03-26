# Fitbase Booking Systém - Fáza 1

Tento projekt obsahuje implementáciu 1. fázy rezervačného systému pre trénerov.

## Funkcionalita
- **Zobrazenie voľných slotov**: Dynamicky vypočítané na základe pravidiel v `availability_slots` a existujúcich rezervácií.
- **Rezervačný formulár**: Validácia cez Zod, mobilný-first dizajn, tmavý režim.
- **Server-side spracovanie**: Server Actions pre bezpečné vytvorenie rezervácie.
- **Ochrana proti double-booking**: Unikátny index v databáze + kontrola na serveri pred zápisom.
- **Emailové notifikácie**: Potvrdenie pre klienta a notifikácia pre admina (trénera).

## Požiadavky na databázu (Supabase)
Spustite SQL migrácie v priečinku `supabase/migrations/`:
1. `1774451700_create_bookings_table.sql`: Vytvorí tabuľku `bookings` a potrebné ENUM typy.
2. `1774451800_booking_policies.sql`: Nastaví RLS politiky a ochranu proti duplicitám.

### Predpokladaná štruktúra `availability_slots`
Tabuľka by mala obsahovať:
- `id` (uuid)
- `trainer_id` (uuid)
- `day_of_week` (int, 1=Pondelok...7=Nedeľa)
- `start_time` (time)
- `end_time` (time)
- `is_active` (boolean)

## Premenné prostredia (.env)
Uistite sa, že máte nastavené nasledujúce premenné:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xjdrjyfbookmabcycljo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqZHJqeWZib29rbWFiY3ljbGpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNjEyMjIsImV4cCI6MjA4OTgzNzIyMn0.GPAk7XSEgnrW21sesTaGon46tASWFpyxrUy3UDCr0bM
SUPABASE_SERVICE_ROLE_KEY=VeyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqZHJqeWZib29rbWFiY3ljbGpvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI2MTIyMiwiZXhwIjoyMDg5ODM3MjIyfQ.5OhSIcAlErPDHl6BJgK1N11dMFpLpZEZfdQReOUISl0
```

## TODO pre ďalšie fázy
- [ ] **Stripe Checkout**: Integrovať Stripe do `createBookingAction`. Po vytvorení `pending` rezervácie presmerovať na Stripe Checkout Session.
- [ ] **Reminders**: Nastaviť Cron job (napr. cez Vercel Cron) na odosielanie pripomienok 24h pred tréningom.
- [ ] **Reschedule / Cancel**: Pridanie odkazu do emailu na zrušenie alebo zmenu termínu klientom.
- [ ] **Email Service**: Nahradiť mock implementáciu v `src/lib/email/emailService.ts` skutočnou službou (napr. Resend).

## Nasadenie
1. Spustite SQL migrácie v Supabase SQL Editore.
2. Nastavte ENV premenné vo Vercel projekte.
3. Pushnite zmeny do repozitára.
