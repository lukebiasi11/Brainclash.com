export function createFieldHandler(options?: {
  collection?: string;
  allowedOrigins?: string[];
  db?: { call: (name: string, args: (string | number | number[] | null)[]) => Promise<unknown> };
  getClaims?: (jwt: string) => Promise<unknown>;
}): (request: Request) => Promise<Response>;
