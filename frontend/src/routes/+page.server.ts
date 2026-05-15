// Root route — forward to the inventory.
//
// Phase 1 shipped `/` as a placeholder dashboard ("VM and LXC inventory
// lands in Phase 2"). Phase 2 put the real inventory at /inventory; the
// root now simply forwards there so a logged-in user lands straight on
// their resources instead of an empty placeholder.
//
// Unauthenticated requests never reach this — the +layout.server.ts auth
// gate redirects them to /login first.

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  throw redirect(303, '/inventory');
};
