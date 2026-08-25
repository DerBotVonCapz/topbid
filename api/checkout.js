// api/checkout.js — creates a Stripe Checkout Session for a dynamic bid amount.
// Secrets come from Vercel env vars, never from the client.
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  try {
        const { name, description, link, category, bid } = req.body || {};

      const amount = Math.round(Number(bid) * 100); // cents
      if (!name || !link || !/^https?:\/\//.test(link)) return res.status(400).json({ error: 'invalid input' });
        if (!(amount >= 200)) return res.status(400).json({ error: 'minimum bid is $2' });

      const origin = req.headers.origin || `https://${req.headers.host}`;

      const session = await stripe.checkout.sessions.create({
              mode: 'payment',
              line_items: [{
                        quantity: 1,
                        price_data: {
                                    currency: 'usd',
                                    unit_amount: amount,
                                    product_data: {
                                                  name: `topbid — ${name} spot`,
                                                  description: `Promoted placement in "${category}" at $${(amount / 100).toFixed(0)}`,
                                    },
                        },
              }],
              metadata: {
                        name: String(name).slice(0, 40),
                        description: String(description || '').slice(0, 80),
                        link: String(link).slice(0, 300),
                        category: String(category || 'Tools').slice(0, 40),
                        bid: String(Number(bid)),
              },
              success_url: `${origin}/?paid=1`,
              cancel_url: `${origin}/`,
      });

      return res.status(200).json({ url: session.url });
  } catch (err) {
        console.error('checkout error', err);
        return res.status(500).json({ error: 'checkout failed' });
  }
}
