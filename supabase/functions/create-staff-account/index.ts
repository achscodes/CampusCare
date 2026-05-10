import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ROLES_BY_OFFICE: Record<string, string[]> = {
  development: ["SDAO Coordinator", "SDAO Associate", "Senior Supervisor"],
  discipline: ["DO Coordinator", "DO Assistant"],
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ ok: false, error: "Server misconfigured (missing Supabase env)." }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ ok: false, error: "Missing authorization." }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !authData?.user) {
      return json({ ok: false, error: "Unauthorized." }, 401);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: profile, error: pErr } = await admin
      .from("profiles")
      .select("id, role, office, account_status, designation")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (pErr || !profile || profile.account_status !== "approved") {
      return json({ ok: false, error: "Forbidden." }, 403);
    }

    const des = String(profile.designation ?? "").toLowerCase().trim();
    const isFacilityHsoAdmin = profile.office === "health" && des === "admin";
    const isWelfare =
      profile.role === "Super Admin" || (profile.role === "Admin" && !isFacilityHsoAdmin);
    const dualOffice = profile.office === "discipline" || profile.office === "development";
    if (!isWelfare || !dualOffice) {
      return json(
        { ok: false, error: "Only DO/SDAO welfare admins can create accounts here." },
        403,
      );
    }

    const body = (await req.json()) as Record<string, unknown>;
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const first_name = String(body.first_name ?? "").trim();
    const middle_initial = String(body.middle_initial ?? "").trim().slice(0, 3);
    const last_name = String(body.last_name ?? "").trim();
    const office = String(body.office ?? "").trim().toLowerCase();
    const role = String(body.role ?? "").trim();

    if (!email || !password || password.length < 8) {
      return json({ ok: false, error: "Email and password (at least 8 characters) are required." }, 400);
    }
    if (!first_name || !last_name) {
      return json({ ok: false, error: "First and last name are required." }, 400);
    }
    if (office !== "discipline" && office !== "development") {
      return json({ ok: false, error: "Invalid department." }, 400);
    }
    const allowed = ROLES_BY_OFFICE[office];
    if (!allowed || !allowed.includes(role)) {
      return json({ ok: false, error: "Role does not match department." }, 400);
    }

    const { data: created, error: cuErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name,
        middle_initial,
        last_name,
        office,
        role,
      },
    });

    if (cuErr) {
      return json({ ok: false, error: cuErr.message || String(cuErr) }, 400);
    }

    const uid = created.user?.id;
    if (!uid) {
      return json({ ok: false, error: "User was not created." }, 400);
    }

    await admin.from("profiles").update({ account_status: "approved" }).eq("id", uid);

    return json({ ok: true, userId: uid });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ ok: false, error: msg }, 400);
  }
});
