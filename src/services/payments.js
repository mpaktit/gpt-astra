// Payments boundary. The client NEVER decides it was paid. In production, `live` mode opens a
// server-created checkout session (e.g. Stripe Checkout / app-store IAP), and the SERVER credits
// crystals to a server-side wallet after verifying the webhook. See docs/SECURITY.md.
//
// Modes:
//   disabled  default in production until the backend exists. Store shows "opens at launch".
//   demo      localhost or ?demo-store=1. Grants instantly, receipts marked demo. For testing UX.
//   live      requires config.checkoutUrl; client only redirects, never grants.

export function detectPaymentsMode(loc = globalThis.location) {
  if (!loc) return 'disabled';
  const params = new URLSearchParams(loc.search || '');
  if (params.get('demo-store') === '1') return 'demo';
  if (['localhost', '127.0.0.1'].includes(loc.hostname)) return 'demo';
  return globalThis.ASTRA_CONFIG?.checkoutUrl ? 'live' : 'disabled';
}

export function createPayments(mode = detectPaymentsMode()) {
  return {
    mode,
    async purchase(pack) {
      if (mode === 'demo') return { ok: true, receipt: `demo-${pack.id}-${Date.now()}`, demo: true };
      if (mode === 'live') {
        const url = new URL(globalThis.ASTRA_CONFIG.checkoutUrl);
        url.searchParams.set('sku', pack.id);
        globalThis.location.assign(url.toString());
        return { ok: false, pending: true };
      }
      return { ok: false, error: 'The crystal store opens at launch.' };
    },
  };
}
