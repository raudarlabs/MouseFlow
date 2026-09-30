/* Types for the browser half of api/_product.mjs. Change together. */
export type ProductId = 'do' | 'make';
export const PRODUCT_HOSTS: Record<string, ProductId>;
export function productOfHost(host: string | null | undefined, map?: Record<string, string>): ProductId | null;
export function productOfRequest(req: unknown, map?: Record<string, string>): ProductId | null;
