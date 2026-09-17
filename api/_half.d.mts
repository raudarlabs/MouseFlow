export type Half = 'did' | 'ran' | 'both';
export declare const BLOCKS: { did: string[]; ran: string[] };
export declare function halfAsked(raw: unknown): Half;
export declare function blocksFor(half: unknown): Set<string>;
