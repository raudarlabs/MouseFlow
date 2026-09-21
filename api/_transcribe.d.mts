/* Types for the browser half. The composer imports the sentences and the ceiling from here rather than
 * keeping its own, because "where does the audio go" must have ONE answer - the page shows it, the route
 * serves it, and two editions of that promise are one promise and one lie. */

export const WHERE_AUDIO_GOES: string;
export const STAYS_HERE: string;
export const AUDIO_MAX_BYTES: number;
export const RESULT_MAX: number;
export const TRANSCRIBE_MODEL_VAR: string;
export const NO_MODEL: string;
export const AUDIO_TYPES: Set<string>;

export function extensionFor(type: string): string | null;
export function refusedAudio(one: { bytes: number; type: string }): string | null;
export function modelFrom(env: Record<string, string | undefined> | null): string | null;
export function cleanTranscript(said: unknown): string;
