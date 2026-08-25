// api/webhook.js — Stripe calls this after a successful payment.
// Verifies the signature, then writes the paid spot to Supabase using the
// service-role key (server-only, bypasses RLS). This is the ONLY way a row
// gets on the board — nobody ranks without paying.
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = { api: { bodyParser: false } };

function rawBody(req) {
    return new Promise((resolve, reject) => {
          let data = '';
          req.on('data', (c) => (data += c));
          req.on('end', () => resolve(data));
          req.on('error', reject);
    });
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

  let event;
    try {
          const body = await rawBody(req);
          event = stripe.webhooks.constructEvent(
                  body,
                  req.headers['stripe-signature'],
                  process.env.STRIPE_WEBHOOK_SECRET
                );
    } catch (err) {
          console.error('signature verify failed', err.message);
          return res.status(400).send(`Webhook Error: ${err.message}`);
    }

  if (event.type === 'checkout.session.completed') {
        const m = event.data.object.metadata || {};
        try {
                const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/spots`, {
                          method: 'POST',
                          headers: {
                                      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
                                      Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY,
                                      'Content-Type': 'application/json',
                                      Prefer: 'return=minimal',
                          },
                          body: JSON.stringify({
                                      name: m.name,
                                      description: m.description,
                                      link: m.link,
                                      category: m.category,
                                      bid: Number(m.bid),
                          }),
                });
                if (!r.ok) console.error('supabase insert failed', await r.text());
        } catch (err) {
                console.error('supabase insert error', err);
        }
  }

  return res.status(200).json({ received: true });
}
