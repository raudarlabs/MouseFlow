/* Where the form posts. VITE_WAITLIST_ENDPOINT overrides it at build time - a staging API, or the same API
 * behind another domain - and the default is the app deployment's route from the waitlist contract. Read
 * here, once, so the server render and the client bundle are built with the same value and hydrate alike. */
import { DEFAULT_WAITLIST_ENDPOINT } from './waitlist';

export const WAITLIST_ENDPOINT: string =
  (import.meta.env.VITE_WAITLIST_ENDPOINT as string | undefined)?.trim() || DEFAULT_WAITLIST_ENDPOINT;
