// deno-lint-ignore-file no-explicit-any
/**
 * send-push — Supabase Edge Function
 *
 * Triggered by a Database Webhook on INSERT into `public.notifications`.
 * Fetches all device tokens for the row's user and sends an Expo push.
 *
 * Dashboard setup:
 *   1. Deploy:  supabase functions deploy send-push --no-verify-jwt
 *   2. Add secrets:
 *        supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
 *        supabase secrets set SUPABASE_URL=https://<ref>.supabase.co
 *   3. Database → Webhooks → Create
 *        - Table: notifications
 *        - Events: Insert
 *        - HTTP POST to:  https://<ref>.functions.supabase.co/send-push
 *        - HTTP Headers:  Authorization: Bearer <anon-or-service-key>
 */

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type NotificationRow = {
  id: string;
  user_id: string;
  category: string;
  title: string;
  body: string;
  href: string;
  read_at: string | null;
  created_at: string;
};

type WebhookPayload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: NotificationRow;
  old_record: NotificationRow | null;
};

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default';
  priority?: 'default' | 'high';
  channelId?: string;
};

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return new Response('Missing env', { status: 500 });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  if (payload.type !== 'INSERT' || payload.table !== 'notifications' || !payload.record) {
    return new Response(JSON.stringify({ skipped: true }), {
      headers: { 'content-type': 'application/json' },
    });
  }

  const row = payload.record;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: tokens, error } = await admin
    .from('device_tokens')
    .select('expo_token, platform')
    .eq('user_id', row.user_id);

  if (error) {
    console.error('[send-push] token lookup failed:', error);
    return new Response('DB error', { status: 500 });
  }

  if (!tokens?.length) {
    return new Response(JSON.stringify({ sent: 0, reason: 'no tokens' }), {
      headers: { 'content-type': 'application/json' },
    });
  }

  const messages: ExpoPushMessage[] = tokens.map((t: any) => ({
    to: t.expo_token,
    title: row.title,
    body: row.body,
    data: { href: row.href, notificationId: row.id, category: row.category },
    sound: 'default',
    priority: 'high',
    channelId: 'default',
  }));

  // Expo accepts batches of up to 100 messages.
  const batches: ExpoPushMessage[][] = [];
  for (let i = 0; i < messages.length; i += 100) batches.push(messages.slice(i, i + 100));

  const results: unknown[] = [];
  for (const batch of batches) {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(batch),
    });
    const json = await res.json().catch(() => null);
    results.push(json);

    // Clean up dead tokens reported by Expo.
    if (Array.isArray(json?.data)) {
      for (let i = 0; i < json.data.length; i++) {
        const ticket = json.data[i];
        if (ticket?.status === 'error' && ticket?.details?.error === 'DeviceNotRegistered') {
          const deadToken = batch[i]?.to;
          if (deadToken) {
            await admin.from('device_tokens').delete().eq('expo_token', deadToken);
          }
        }
      }
    }
  }

  return new Response(
    JSON.stringify({ sent: messages.length, batches: results.length, results }),
    { headers: { 'content-type': 'application/json' } },
  );
});
