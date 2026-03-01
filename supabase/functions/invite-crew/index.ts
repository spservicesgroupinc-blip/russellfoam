import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // Admin client — service role, never exposed to frontend
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // The gateway (verify_jwt: true) already validated the JWT signature.
    // Decode the payload to get the caller's user ID without a second network hop.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let callerId: string;
    try {
      const payload = JSON.parse(atob(authHeader.replace('Bearer ', '').split('.')[1]));
      callerId = payload.sub;
      if (!callerId) throw new Error('No sub claim');
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify caller is an admin using the admin client (bypasses RLS)
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('company_id, role')
      .eq('id', callerId)
      .single();

    if (profileError || callerProfile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Only admins can invite crew members' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { email, password, crewProfile } = await req.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create crew auth user. The handle_new_user trigger will fire and create
    // the profiles row linked to the admin's company (not a new company).
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: 'crew',
        company_id: callerProfile.company_id,
        display_name: crewProfile?.name || email,
        crew_metadata: {
          email,
          leadName: crewProfile?.leadName || '',
          phone: crewProfile?.phone || '',
          truckInfo: crewProfile?.truckInfo || '',
          status: crewProfile?.status || 'Active',
        },
      },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ success: true, userId: newUser.user?.id }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
