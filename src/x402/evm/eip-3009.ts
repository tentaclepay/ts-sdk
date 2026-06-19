import { z } from "zod";

export const transferWithAuthorizationScheme = z.object({
  from: z.templateLiteral(["0x", z.string()]),
  to: z.templateLiteral(["0x", z.string()]),
  value: z.string(),
  validAfter: z.string(),
  validBefore: z.string(),
  nonce: z.templateLiteral(["0x", z.string()]),
});
export type TransferWithAuthorization = z.infer<
  typeof transferWithAuthorizationScheme
>;
