// Admin validation.
//
// The shapes only the /admin workspace sends. Kept apart from the tournament
// validators on purpose: what an admin curates is a *published event*, not a
// tournament, and the organizer-facing schemas must never grow a field that
// would let an organizer reach this endpoint's job.

import { z } from "zod";

/**
 * The homepage Spotlight toggle. `featured` lives on `events`, so the route
 * addresses the catalogue row by slug rather than the tournament that
 * published it — an admin curates the catalogue, not someone's workspace.
 */
export const eventFeaturedSchema = z.object({
  featured: z.boolean({
    errorMap: () => ({ message: "Featured must be true or false." }),
  }),
});
