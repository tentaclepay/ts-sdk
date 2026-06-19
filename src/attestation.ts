import { bcs } from "@mysten/sui/bcs";
import { concatBytes } from "@noble/curves/utils.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";

import { ID } from "./bcs";

export type PayAndSignPreimage = {
  protocolId: string;
  signerId: string;
  coordinatorId: string;
  amount: bigint;
  message: Uint8Array;
  messageCentralizedSignature: Uint8Array;
  validBefore: bigint;
};

export const buildPayAndSignAttestationBytes = ({
  protocolId,
  signerId,
  coordinatorId,
  amount,
  message,
  messageCentralizedSignature,
  validBefore,
}: PayAndSignPreimage): Uint8Array =>
  keccak_256(
    concatBytes(
      utf8ToBytes("pay_and_sign"),
      ID.serialize(protocolId).toBytes(),
      ID.serialize(signerId).toBytes(),
      ID.serialize(coordinatorId).toBytes(),
      bcs.u64().serialize(amount).toBytes(),
      message,
      keccak_256(messageCentralizedSignature),
      bcs.u64().serialize(validBefore).toBytes()
    )
  );
