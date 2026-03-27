import { createClient } from "@supabase/supabase-js";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TrainerIdRedirectPage({
  params,
  searchParams,
}: {
  params: { trainerId: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) notFound();

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const res = await supabase
    .from("trainers")
    .select("slug")
    .eq("id", params.trainerId)
    .maybeSingle<{ slug: string | null }>();

  const slug = res.data?.slug?.trim();

  if (res.error || !slug) notFound();

  const qs = searchParams
    ? new URLSearchParams(
        Object.entries(searchParams).flatMap(([k, v]) => {
          if (typeof v === "string") return [[k, v]];
          if (Array.isArray(v)) return v.map((x) => [k, x] as [string, string]);
          return [];
        })
      ).toString()
    : "";

  redirect(`/${slug}${qs ? `?${qs}` : ""}`);
}
