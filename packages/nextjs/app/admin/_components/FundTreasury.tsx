"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { parseUnits } from "viem";
import { useAccount } from "wagmi";
import { useDeployedContractInfo, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

export function FundTreasury() {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const [fundAmount, setFundAmount] = useState("");
  const [funding, setFunding] = useState(false);
  const [minting, setMinting] = useState(false);

  const { data: creditVaultInfo } = useDeployedContractInfo({ contractName: "CreditVault" });

  // All public writes — no Unlink privacy on the lender side
  const { writeContractAsync: writeUsdc } = useScaffoldWriteContract({
    contractName: "MockUSDC",
    disableSimulate: true,
  });
  const { writeContractAsync: writeCreditVault } = useScaffoldWriteContract({
    contractName: "CreditVault",
    disableSimulate: true,
  });

  const handleFund = async () => {
    if (!creditVaultInfo?.address || !fundAmount || !address) return;
    setFunding(true);
    try {
      const amount = parseUnits(fundAmount, 6);
      const approveResult = await writeUsdc({ functionName: "approve", args: [creditVaultInfo.address, amount] });
      if (!approveResult) throw new Error("Approve transaction was not submitted.");
      const depositResult = await writeCreditVault({ functionName: "deposit", args: [amount] });
      if (!depositResult) throw new Error("Deposit transaction was not submitted.");
      await queryClient.refetchQueries();
      notification.success("Deposited into Credit Vault!");
      setFundAmount("");
    } catch (e: unknown) {
      notification.error(e instanceof Error ? e.message : "Deposit failed");
    } finally {
      setFunding(false);
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

  const isLoading = funding || minting;

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">Fund Credit Vault</h2>
        <p className="text-sm opacity-70">
          Deposit USDC into the Credit Vault to provide liquidity for wage-backed loans.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            className="input input-bordered flex-1"
            placeholder="Amount (USDC)"
            value={fundAmount}
            onChange={e => setFundAmount(e.target.value)}
          />
          <button className="btn btn-primary" onClick={handleFund} disabled={isLoading || !fundAmount}>
            {funding ? <span className="loading loading-spinner loading-sm" /> : "Deposit"}
          </button>
        </div>
        <div className="divider text-xs opacity-50">TESTING</div>
        <button className="btn btn-secondary btn-sm" onClick={handleMintTestUsdc} disabled={isLoading}>
          {minting ? <span className="loading loading-spinner loading-sm" /> : "Mint 10,000 Test USDC"}
        </button>
      </div>
    </div>
  );
}
