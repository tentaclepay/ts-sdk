import { bcs } from "@mysten/sui/bcs";
import { fromHex, toHex } from "@mysten/sui/utils";

/// 32-byte array with no length prefix, so this matches `object::id(_).to_bytes()`.
export const ID = bcs.fixedArray(32, bcs.u8()).transform({
  input: (id: string) => fromHex(id.startsWith("0x") ? id.slice(2) : id),
  output: (id) => `0x${toHex(Uint8Array.from(id))}`,
});

export const Signer = bcs.struct("Signer", {
  id: ID,
  network_encryption_key_id: ID,
  dwallet_cap: bcs.struct("DWalletCap", {
    id: ID,
    dwallet_id: ID,
  }),
  curve: bcs.U32,
  signature_algorithm: bcs.U32,
  hash_scheme: bcs.U32,
  presigns: bcs.vector(
    bcs.struct("UnverifiedPresignCap", {
      id: ID,
      dwallet_id: bcs.option(ID),
      presign_id: ID,
    })
  ),
  ika_balance: bcs.U64,
  sui_balance: bcs.U64,
});

export const SignerCreatedEvent = bcs.struct("SignerCreated", {
  signer_id: ID,
  network_encryption_key_id: ID,
  curve: bcs.U32,
  signature_algorithm: bcs.U32,
  hash_scheme: bcs.U32,
});

export const ProtocolCreatedEvent = bcs.struct("ProtocolCreated", {
  protocol_id: ID,
  verifier_pubkey: bcs.vector(bcs.U8),
});

export const PaymentSucceedEvent = bcs.struct("PaymentSucceed", {
  sign_id: ID,
  amount: bcs.U64,
});
