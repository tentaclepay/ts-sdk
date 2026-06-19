import {
  Curve as IkaCurve,
  Hash as IkaHash,
  SignatureAlgorithm as IkaSignatureAlgorithm,
} from "@ika.xyz/sdk";

export const curves = [0, 1, 2, 3] as const;
export type Curve = (typeof curves)[number];

export const parseIkaCurve = (curve: Curve): IkaCurve => {
  switch (curve) {
    case 0:
      return IkaCurve.SECP256K1;
    case 1:
      return IkaCurve.SECP256R1;
    case 2:
      return IkaCurve.ED25519;
    case 3:
      return IkaCurve.ED25519;
    default:
      throw new Error("Invalid curve");
  }
};

export const signatureAlgorithms = {
  0: [0, 1],
  1: [0],
  2: [0],
  3: [0],
} as const satisfies {
  [TCurve in Curve]: number[];
};
export type SignatureAlgorithm<TCurve extends Curve> =
  (typeof signatureAlgorithms)[TCurve][number];

export const parseIkaSignatureAlgorithm = <TCurve extends Curve>(
  curve: TCurve,
  signatureAlgorithm: SignatureAlgorithm<TCurve>
): IkaSignatureAlgorithm => {
  switch (curve) {
    case 0:
      switch (signatureAlgorithm) {
        case 0:
          return IkaSignatureAlgorithm.ECDSASecp256k1;
        case 1:
          return IkaSignatureAlgorithm.Taproot;
        default:
          throw new Error("Invalid signature algorithm");
      }
    case 1:
      return IkaSignatureAlgorithm.ECDSASecp256r1;
    case 2:
      return IkaSignatureAlgorithm.EdDSA;
    case 3:
      return IkaSignatureAlgorithm.SchnorrkelSubstrate;
    default:
      throw new Error("Invalid curve");
  }
};

export const hashSchemes = {
  0: {
    0: [0, 1, 2],
    1: [0],
  },
  1: {
    0: [0],
  },
  2: {
    0: [0],
  },
  3: {
    0: [0],
  },
} as const satisfies {
  [TCurve in Curve]: {
    [TAlgorithm in SignatureAlgorithm<TCurve>]: number[];
  };
};
export type HashScheme<
  TCurve extends Curve,
  TAlgorithm extends SignatureAlgorithm<TCurve>,
> = TAlgorithm extends keyof (typeof hashSchemes)[TCurve]
  ? (typeof hashSchemes)[TCurve][TAlgorithm] extends readonly (infer THash)[]
    ? THash
    : never
  : never;

export const parseIkaHashScheme = <
  TCurve extends Curve,
  TAlgorithm extends SignatureAlgorithm<TCurve>,
>(
  curve: TCurve,
  signatureAlgorithm: TAlgorithm,
  hashScheme: HashScheme<TCurve, TAlgorithm>
): IkaHash => {
  switch (curve) {
    case 0:
      switch (signatureAlgorithm) {
        case 0:
          switch (hashScheme) {
            case 0:
              return IkaHash.KECCAK256;
            case 1:
              return IkaHash.SHA256;
            case 2:
              return IkaHash.DoubleSHA256;
            default:
              throw new Error("Invalid hash scheme");
          }
        case 1:
          return IkaHash.SHA256;
        default:
          throw new Error("Invalid signature algorithm");
      }
    case 1:
      return IkaHash.SHA256;
    case 2:
      return IkaHash.SHA512;
    case 3:
      return IkaHash.Merlin;
    default:
      throw new Error("Invalid curve");
  }
};
