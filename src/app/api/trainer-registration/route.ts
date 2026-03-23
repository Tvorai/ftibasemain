export const runtime = "nodejs";

export async function POST(req: Request) {
  void req;
  return Response.json(
    {
      ok: false,
      message: "Táto registrácia už nevytvára trénerský profil počas signup. Trénerský profil sa vytvorí po prvom prihlásení."
    },
    { status: 410 }
  );
}
