import type { IkaClient, SignWithState } from "@ika.xyz/sdk";
import type { ClientWithCoreApi } from "@mysten/sui/client";
import type { Keypair } from "@mysten/sui/cryptography";
import type { ClientEvmSigner } from "@x402/evm";
import {
  CoordinatorInnerModule,
  createUserSignMessageWithPublicOutput,
} from "@ika.xyz/sdk";
import { coinWithBalance, Transaction } from "@mysten/sui/transactions";
import { fromBase64, SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import { concat, fromHex, hashTypedData, toHex } from "viem";

import type { Curve, HashScheme, SignatureAlgorithm } from "../../crypto";
import { PaymentSucceedEvent, Signer } from "../../bcs";
import {
  TENTACLEPAY_EVM_DWALLET_ADDRESS,
  TENTACLEPAY_EVM_SIGNER_ID,
  TENTACLEPAY_MODULE,
  TENTACLEPAY_PACKAGE_ID,
  TENTACLEPAY_PAY_AND_SIGN,
  TENTACLEPAY_PROTOCOL_ID,
  USDC_COIN_TYPE,
} from "../../constants";
import {
  parseIkaCurve,
  parseIkaHashScheme,
  parseIkaSignatureAlgorithm,
} from "../../crypto";
import { transferWithAuthorizationScheme } from "./eip-3009";

function ikaSignatureToEvmSignature(signature: number[] | Uint8Array) {
  const bytes =
    signature instanceof Uint8Array ? signature : Uint8Array.from(signature);
  const [recoveryId] = bytes;

  const r = toHex(bytes.slice(1, 33));
  const s = toHex(bytes.slice(33, 65));
  const v = (recoveryId ?? 0) + 27;

  return concat([r, s, toHex(v, { size: 1 })]);
}

export const createCrossChainEvmSigner = async (
  keypair: Keypair,
  verifierUrl: string,
  suiClient: ClientWithCoreApi,
  ikaClient: IkaClient
): Promise<ClientEvmSigner> => {
  await ikaClient.ensureInitialized();
  const ikaCoordinator = ikaClient.ikaConfig.objects.ikaDWalletCoordinator;

  return {
    address: TENTACLEPAY_EVM_DWALLET_ADDRESS,
    signTypedData: async (typedData) => {
      const authorization = transferWithAuthorizationScheme.parse(
        typedData.message
      );

      const { object: signerObject } = await suiClient.core.getObject({
        objectId: TENTACLEPAY_EVM_SIGNER_ID,
        include: {
          content: true,
        },
      });

      const signer = Signer.parse(signerObject.content);

      const dwallet = await ikaClient.getDWalletInParticularState(
        signer.dwallet_cap.dwallet_id,
        "Active"
      );
      if (!dwallet.public_user_secret_key_share)
        throw new Error("Invalid Shared dWallet");

      const publicParameters =
        await ikaClient.getProtocolPublicParameters(dwallet);

      const [presign] = signer.presigns;
      if (!presign) throw new Error("No presigns available");

      const completedPresign = await ikaClient.getPresignInParticularState(
        presign.presign_id,
        "Completed"
      );

      const validBefore = Number(authorization.validBefore) * 1000;

      const message = fromHex(hashTypedData(typedData), "bytes");

      const curve = signer.curve as Curve;
      const signatureAlgorithm =
        signer.signature_algorithm as SignatureAlgorithm<typeof curve>;
      const hashScheme = signer.hash_scheme as HashScheme<
        typeof curve,
        typeof signatureAlgorithm
      >;

      const ikaCurve = parseIkaCurve(curve);
      const ikaSignatureAlgorithm = parseIkaSignatureAlgorithm(
        curve,
        signatureAlgorithm
      );
      const ikaHashScheme = parseIkaHashScheme(
        curve,
        signatureAlgorithm,
        hashScheme
      );

      const messageCentralizedSignature =
        await createUserSignMessageWithPublicOutput(
          publicParameters,
          Uint8Array.from(dwallet.state.Active.public_output),
          Uint8Array.from(dwallet.public_user_secret_key_share), // shared dWallet → public share
          Uint8Array.from(completedPresign.state.Completed.presign),
          message, // the PREIMAGE
          ikaHashScheme,
          ikaSignatureAlgorithm,
          ikaCurve
        );

      const requestAttestation = await fetch(`${verifierUrl}/verify`, {
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          protocolId: TENTACLEPAY_PROTOCOL_ID,
          signerId: TENTACLEPAY_EVM_SIGNER_ID,
          coordinatorId: ikaCoordinator.objectID,
          amount: authorization.value,
          message: message.toBase64(),
          messageCentralizedSignature: messageCentralizedSignature.toBase64(),
          validBefore,
        }),
      });
      if (!requestAttestation.ok) throw new Error("Request attestation failed");

      const { attestationSignature } = (await requestAttestation.json()) as {
        attestationSignature: string;
      };

      const tx = new Transaction();

      tx.setSender(keypair.toSuiAddress());
      tx.moveCall({
        package: TENTACLEPAY_PACKAGE_ID,
        module: TENTACLEPAY_MODULE,
        function: TENTACLEPAY_PAY_AND_SIGN,
        arguments: [
          tx.object(TENTACLEPAY_PROTOCOL_ID),
          tx.object(TENTACLEPAY_EVM_SIGNER_ID),
          tx.object(ikaCoordinator.objectID),
          coinWithBalance({
            balance: authorization.value,
            type: USDC_COIN_TYPE,
          }),
          tx.pure.vector("u8", Array.from(message)),
          tx.pure.vector("u8", Array.from(messageCentralizedSignature)),
          tx.pure.vector("u8", Array.from(fromBase64(attestationSignature))),
          tx.pure.u64(validBefore),
          tx.object(SUI_CLOCK_OBJECT_ID),
        ],
      });

      const txBytes = await tx.build({ client: suiClient });

      const txResult = await suiClient.core.signAndExecuteTransaction({
        transaction: txBytes,
        signer: keypair,
        include: {
          events: true,
        },
      });

      if (txResult.$kind === "FailedTransaction")
        throw new Error("Transaction failed!");

      const paymentSucceedEvent = txResult.Transaction.events.find(
        (event) =>
          event.packageId === TENTACLEPAY_PACKAGE_ID &&
          event.module === TENTACLEPAY_MODULE &&
          event.eventType ===
            `${TENTACLEPAY_PACKAGE_ID}::${TENTACLEPAY_MODULE}::MessageSigned`
      );
      if (!paymentSucceedEvent) throw new Error("No payment success event");

      const { sign_id } = PaymentSucceedEvent.parse(paymentSucceedEvent.bcs);

      const completedSign = await ikaClient.getSignInParticularState(
        sign_id,
        ikaCurve,
        ikaSignatureAlgorithm,
        "Completed"
      );

      const { object: signObject } = await suiClient.core.getObject({
        objectId: completedSign.id,
        include: {
          content: true,
        },
      });

      const sign = CoordinatorInnerModule.SignSession.parse(
        signObject.content
      ) as SignWithState<"Completed">;

      const signature = ikaSignatureToEvmSignature(
        sign.state.Completed.signature
      );

      return signature;
    },
  };
};
