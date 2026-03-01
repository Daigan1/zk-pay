"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount, usePublicClient, useSendTransaction } from "wagmi";
import { usePrivacy } from "~~/components/PrivacyProvider";
import { useDeployedContractInfo, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

/** Unlink pool contract on monad-testnet — USDC must be approved to this address */
const UNLINK_POOL = "0x0813da0a10328e5ed617d37e514ac2f6fa49a254";
const SHIELD_AMOUNT = 1_000_000n; // 1 USDC (6 decimals)

const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export function ShieldUsdcButton() {
  const { address } = useAccount();
  const { unlinkDeposit, unlinkBalances, unlinkRefresh } = usePrivacy();
  const { data: usdcInfo } = useDeployedContractInfo({ contractName: "MockUSDC" });
  const { writeContractAsync: writeUsdc } = useScaffoldWriteContract({
    contractName: "MockUSDC",
    disableSimulate: true,
  });
  const { sendTransactionAsync } = useSendTransaction();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  // Check actual shielded balance instead of localStorage
  const usdcAddress = usdcInfo?.address?.toLowerCase() ?? "";
  const shieldedBalance = usdcAddress
    ? (Object.entries(unlinkBalances).find(([k]) => k.toLowerCase() === usdcAddress)?.[1] ?? 0n)
    : 0n;
  const isShielded = shieldedBalance > 0n;

  if (isShielded) {
    return <span className="badge badge-success badge-sm">USDC Shielded</span>;
  }

  const handleShield = async () => {
    if (!address || !unlinkDeposit || !usdcInfo?.address || !publicClient) return;
    setBusy(true);
    try {
      // Check existing balance and allowance to skip unnecessary transactions
      const [balance, allowance] = await Promise.all([
        publicClient.readContract({
          address: usdcInfo.address,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [address],
        }),
        publicClient.readContract({
          address: usdcInfo.address,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [address, UNLINK_POOL],
        }),
      ]);

      // Only mint if balance is insufficient
      if (balance < SHIELD_AMOUNT) {
        await writeUsdc({ functionName: "mint", args: [address, SHIELD_AMOUNT] });
      }
      // Only approve if allowance is insufficient
      if (allowance < SHIELD_AMOUNT) {
        await writeUsdc({ functionName: "approve", args: [UNLINK_POOL, SHIELD_AMOUNT] });
      }
      // Generate deposit calldata from Unlink SDK and submit
      const depositTx = await unlinkDeposit([{ token: usdcInfo.address, amount: SHIELD_AMOUNT, depositor: address }]);
      await sendTransactionAsync({ to: depositTx.to, data: depositTx.calldata });
      unlinkRefresh?.().catch(() => {});
      await queryClient.invalidateQueries();
      notification.success("1 USDC shielded! Private transactions are ready.");
    } catch (e: unknown) {
      notification.error(e instanceof Error ? e.message : "Shield failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button className="btn btn-warning btn-sm" onClick={handleShield} disabled={busy}>
      {busy ? <span className="loading loading-spinner loading-xs" /> : "Shield USDC (Required)"}
    </button>
  );
}
