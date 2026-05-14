// Dashboard server load — empty in Plan 01-03.
//
// Phase 2 lands the multi-cluster inventory probe here. For now the layout
// load already exposes `apiReachable`, which is all this page needs.

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  return {};
};
