"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AdapterExecutionCall } from "@unlink-xyz/react";
import { type Abi, encodeFunctionData } from "viem";
import { useChainId } from "wagmi";
import { usePrivacy } from "~~/components/PrivacyProvider";
import { useDeployedContractInfo, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import type { ContractName } from "~~/utils/scaffold-eth/contract";
import { contracts } from "~~/utils/scaffold-eth/contract";

/** Minimum USDC spend to satisfy Unlink's "at least one spend token" requirement */
const MIN_PRIVACY_SPEND = 1n; // 1 wei USDC

type InteractParams = {
  functionName: string;
  args?: unknown[];
  /** Tokens to unshield from private balance before the call (privacy mode only) */
  spend?: { token: string; amount: bigint }[];
  /** Tokens expected back from the call to reshield (privacy mode only) */
  receive?: { token: string; minAmount: bigint }[];
  /** ETH value to send with the call */
  value?: bigint;
};

/**
 * Dual-mode hook for contract interactions.
 *
 * - **Public mode** (Anvil): delegates to `useScaffoldWriteContract`.
 * - **Privacy mode** (monad-testnet): routes through Unlink adapter.
 *
 * In privacy mode, if no spend/receive tokens are provided, auto-injects
 * 1 wei of USDC. The user must have shielded USDC first (via ShieldUsdcButton).
 *
 * Note: Each privacy-mode interact triggers 3 sequential operations internally:
 * 1. unshield (spend tokens from private balance)
 * 2. execute (call the target contract via adapter)
 * 3. reshield (return tokens to private balance)
 * This is inherent to Unlink's privacy model, not redundant calls.
 */
export function usePrivateInteract<T extends ContractName>(contractName: T) {
  const { isPrivacyAvailable, unlinkInteract, unlinkRefresh } = usePrivacy();
  // disableSimulate prevents simulation failures during sequential writes
  // (e.g., approve → deposit where simulation of deposit sees stale approval state)
  const { writeContractAsync } = useScaffoldWriteContract({ contractName, disableSimulate: true });
  const { data: contractInfo } = useDeployedContractInfo({ contractName });
  const chainId = useChainId();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  // Read USDC address from static contracts object (avoids async getBytecode race condition)
  const usdcAddress = (contracts as Record<number, Record<string, { address: string }>>)?.[chainId]?.["MockUSDC"]
    ?.address as `0x${string}` | undefined;

  const interact = useCallback(
    async (params: InteractParams) => {
      setBusy(true);
      try {
        if (isPrivacyAvailable && unlinkInteract) {
          if (!contractInfo?.address || !contractInfo?.abi) {
            throw new Error(`Contract ${contractName} not deployed`);
          }

          const abiItem = contractInfo.abi.find(
            item => "name" in item && item.name === params.functionName && item.type === "function",
          );
          if (!abiItem || abiItem.type !== "function") {
            throw new Error(`Function ${params.functionName} not found in ${contractName} ABI`);
          }

          const data = encodeFunctionData({
            abi: [abiItem] as Abi,
            functionName: params.functionName,
            args: params.args ?? [],
          });

          const call: AdapterExecutionCall = {
            to: contractInfo.address,
            data,
            value: params.value ?? 0n,
          };

          if (!usdcAddress) throw new Error("MockUSDC not deployed on current chain");

          const spend =
            params.spend && params.spend.length > 0
              ? params.spend
              : [{ token: usdcAddress, amount: MIN_PRIVACY_SPEND }];
          const receive =
            params.receive && params.receive.length > 0 ? params.receive : [{ token: usdcAddress, minAmount: 0n }];

          const result = await unlinkInteract({ spend, calls: [call], receive });

          // unlinkRefresh can hang indefinitely — fire and forget.
          unlinkRefresh?.().catch(() => {});
          // Await invalidation so callers' UI is fresh before they show notifications.
          // Safe because callers use local handler state with finally (never stuck).
          await queryClient.invalidateQueries();

          return result;
        }

        // Public mode: use scaffold-eth hooks directly
        const result = await writeContractAsync({
          functionName: params.functionName,
          args: params.args,
          value: params.value,
        } as unknown as Parameters<typeof writeContractAsync>[0]);
        // writeContractAsync returns undefined without throwing when the contract
        // isn't loaded or the wallet is on the wrong network. Surface this as an
        // error so callers don't show a false success notification.
        if (result === undefined) {
          throw new Error(`${contractName}.${params.functionName} was not sent — check wallet connection`);
        }
        await queryClient.invalidateQueries();
        return result;
      } finally {
        setBusy(false);
      }
    },
    [
      isPrivacyAvailable,
      unlinkInteract,
      unlinkRefresh,
      writeContractAsync,
      contractInfo,
      contractName,
      usdcAddress,
      queryClient,
    ],
  );

  return {
    interact,
    // Only use local busy state. scaffoldPending from wagmi can get stuck
    // in a true state and is redundant (busy wraps the full operation).
    isPending: busy,
  };
}
