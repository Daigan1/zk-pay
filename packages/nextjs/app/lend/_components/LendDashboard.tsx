"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { formatUnits, parseUnits } from "viem";
import { useAccount } from "wagmi";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { formatUsdc, notification } from "~~/utils/scaffold-eth";

export function LendDashboard() {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawShares, setWithdrawShares] = useState("");
  const [depositing, setDepositing] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [minting, setMinting] = useState(false);

  const { data: creditVaultInfo } = useDeployedContractInfo({ contractName: "CreditVault" });

  // -- Reads (auto-refresh every 30s via block polling; writes also force immediate refetch) --
  const { data: totalAssets } = useScaffoldReadContract({
    contractName: "CreditVault",
    functionName: "totalAssets",
    watch: true,
  });

  const { data: totalLentOut } = useScaffoldReadContract({
    contractName: "CreditVault",
    functionName: "totalLentOut",
    watch: true,
  });

  const { data: availableLiquidity } = useScaffoldReadContract({
    contractName: "CreditVault",
    functionName: "availableLiquidity",
    watch: true,
  });

  const { data: totalFeesCollected } = useScaffoldReadContract({
    contractName: "CreditVault",
    functionName: "totalFeesCollected",
    watch: true,
  });

  const { data: sharePrice } = useScaffoldReadContract({
    contractName: "CreditVault",
    functionName: "sharePrice",
    watch: true,
  });

  const { data: totalShares } = useScaffoldReadContract({
    contractName: "CreditVault",
    functionName: "totalSupply",
    watch: true,
  });

  const { data: myShares } = useScaffoldReadContract({
    contractName: "CreditVault",
    functionName: "balanceOf",
    args: [address],
    watch: true,
  });

  const { data: myAssetsValue } = useScaffoldReadContract({
    contractName: "CreditVault",
    functionName: "convertToAssets",
    args: [myShares ?? 0n],
    watch: true,
  });

  const { data: feeBps } = useScaffoldReadContract({
    contractName: "WageVault",
    functionName: "feeBps",
    watch: true,
  });

  const { data: myUsdcBalance } = useScaffoldReadContract({
    contractName: "MockUSDC",
    functionName: "balanceOf",
    args: [address],
    watch: true,
  });

  // -- Writes (all public, no Unlink) --
  const { writeContractAsync: writeUsdc } = useScaffoldWriteContract({
    contractName: "MockUSDC",
    disableSimulate: true,
  });
  const { writeContractAsync: writeCreditVault } = useScaffoldWriteContract({
    contractName: "CreditVault",
    disableSimulate: true,
  });

  const isLoading = depositing || withdrawing || minting;

  // -- Handlers --
  const handleDeposit = async () => {
    if (!address) return;
    if (!creditVaultInfo?.address) {
      notification.error("Contracts still loading — please wait a moment and try again.");
      return;
    }
    if (!depositAmount || Number(depositAmount) <= 0) {
      notification.error("Enter a valid deposit amount.");
      return;
    }
    setDepositing(true);
    try {
      const amount = parseUnits(depositAmount, 6);
      const approveResult = await writeUsdc({ functionName: "approve", args: [creditVaultInfo.address, amount] });
      if (!approveResult) throw new Error("Approve transaction was not submitted.");
      const depositResult = await writeCreditVault({ functionName: "deposit", args: [amount] });
      if (!depositResult) throw new Error("Deposit transaction was not submitted.");
      await queryClient.refetchQueries();
      notification.success("Deposit successful! You received vault shares.");
      setDepositAmount("");
    } catch (e: unknown) {
      notification.error(e instanceof Error ? e.message : "Deposit failed");
    } finally {
      setDepositing(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawShares || !address) return;
    setWithdrawing(true);
    try {
      const shares = parseUnits(withdrawShares, 6);
      const withdrawResult = await writeCreditVault({ functionName: "withdraw", args: [shares] });
      if (!withdrawResult) throw new Error("Withdraw transaction was not submitted.");
      await queryClient.refetchQueries();
      notification.success("Withdrawal successful!");
      setWithdrawShares("");
    } catch (e: unknown) {
      notification.error(e instanceof Error ? e.message : "Withdrawal failed");
    } finally {
      setWithdrawing(false);
    }
  };

  const handleMintTestUsdc = async () => {
    if (!address) return;
    setMinting(true);
    try {
      const amount = parseUnits("10000", 6);
      const mintResult = await writeUsdc({ functionName: "mint", args: [address, amount] });
      if (!mintResult) throw new Error("Mint transaction was not submitted.");
      await queryClient.refetchQueries();
      notification.success("10,000 test USDC minted to your wallet!");
    } catch (e: unknown) {
      notification.error(e instanceof Error ? e.message : "Mint failed");
    } finally {
      setMinting(false);
    }
  };

  if (!address) {
    return (
      <div className="flex flex-col items-center pt-20 gap-4">
        <h1 className="text-3xl font-bold">Lend</h1>
        <p className="text-lg opacity-70">Connect your wallet to deposit USDC and earn fees.</p>
      </div>
    );
  }

  const sharePriceDisplay = sharePrice ? (Number(sharePrice) / 1e6).toFixed(6) : "1.000000";

  return (
    <div className="flex flex-col items-center pt-10 gap-6 px-5 pb-10">
      <h1 className="text-3xl font-bold">Lend</h1>
      <p className="text-center opacity-70 max-w-lg">
        Deposit USDC into the Credit Vault to fund wage-backed loans. Earn a fixed{" "}
        {feeBps ? `${Number(feeBps) / 100}%` : "..."} fee per borrowing period.
      </p>

      {/* Vault Stats */}
      <div className="card bg-base-100 shadow-xl w-full max-w-lg">
        <div className="card-body">
          <h2 className="card-title">Vault Stats</h2>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <span className="opacity-70">Total Assets</span>
            <span className="text-right font-mono">${formatUsdc(totalAssets)}</span>
            <span className="opacity-70">Currently Lent Out</span>
            <span className="text-right font-mono text-warning">${formatUsdc(totalLentOut)}</span>
            <span className="opacity-70">Available Liquidity</span>
            <span className="text-right font-mono text-success">${formatUsdc(availableLiquidity)}</span>
            <span className="opacity-70">Total Fees Collected</span>
            <span className="text-right font-mono">${formatUsdc(totalFeesCollected)}</span>
            <span className="opacity-70">Share Price</span>
            <span className="text-right font-mono">${sharePriceDisplay}</span>
            <span className="opacity-70">Total Shares</span>
            <span className="text-right font-mono">{formatUsdc(totalShares)}</span>
          </div>
        </div>
      </div>

      {/* My Position */}
      <div className="card bg-base-100 shadow-xl w-full max-w-lg">
        <div className="card-body">
          <h2 className="card-title">Your Position</h2>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <span className="opacity-70">Wallet USDC</span>
            <span className="text-right font-mono">{formatUsdc(myUsdcBalance)} USDC</span>
            <span className="opacity-70">Your Shares</span>
            <span className="text-right font-mono">{formatUsdc(myShares)} zkCRED</span>
            <span className="opacity-70">Value</span>
            <span className="text-right font-mono">${formatUsdc(myAssetsValue)}</span>
          </div>
        </div>
      </div>

      {/* Deposit */}
      <div className="card bg-base-100 shadow-xl w-full max-w-lg">
        <div className="card-body">
          <h2 className="card-title">Deposit USDC</h2>
          <div className="flex gap-2">
            <input
              type="text"
              className="input input-bordered flex-1"
              placeholder="Amount (USDC)"
              value={depositAmount}
              onChange={e => setDepositAmount(e.target.value)}
            />
            <button className="btn btn-primary" onClick={handleDeposit} disabled={isLoading || !depositAmount}>
              {depositing ? <span className="loading loading-spinner loading-sm" /> : "Deposit"}
            </button>
          </div>
          {myUsdcBalance && myUsdcBalance > 0n && (
            <button
              className="btn btn-ghost btn-sm mt-1"
              onClick={() => setDepositAmount(formatUnits(myUsdcBalance!, 6))}
            >
              Max: {formatUsdc(myUsdcBalance)} USDC
            </button>
          )}
          <div className="divider text-xs opacity-50">TESTING</div>
          <button className="btn btn-secondary btn-sm" onClick={handleMintTestUsdc} disabled={isLoading}>
            {minting ? <span className="loading loading-spinner loading-sm" /> : "Mint 10,000 Test USDC"}
          </button>
        </div>
      </div>

      {/* Withdraw */}
      <div className="card bg-base-100 shadow-xl w-full max-w-lg">
        <div className="card-body">
          <h2 className="card-title">Withdraw</h2>
          <p className="text-sm opacity-70">
            Burn vault shares to receive USDC. Can only withdraw USDC not currently lent out.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              className="input input-bordered flex-1"
              placeholder="Shares to burn"
              value={withdrawShares}
              onChange={e => setWithdrawShares(e.target.value)}
            />
            <button className="btn btn-error" onClick={handleWithdraw} disabled={isLoading || !withdrawShares}>
              {withdrawing ? <span className="loading loading-spinner loading-sm" /> : "Withdraw"}
            </button>
          </div>
          {myShares && myShares > 0n && (
            <button className="btn btn-ghost btn-sm mt-1" onClick={() => setWithdrawShares(formatUnits(myShares!, 6))}>
              Max: {formatUsdc(myShares)} shares
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
