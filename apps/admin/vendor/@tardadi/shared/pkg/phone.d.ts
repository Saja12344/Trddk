export declare function normalizePhone(phone: string): string;
/** Saudi mobile stored form: +9665XXXXXXXX. */
export declare function isSaudiMobile(phone: string): boolean;
export declare function requireSaudiMobile(phone: string): string;
/** Match a stored phone that may predate E.164. */
export declare function phoneCandidates(phone: string): string[];
