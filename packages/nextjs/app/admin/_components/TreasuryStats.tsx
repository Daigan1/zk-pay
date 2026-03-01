"use client";

import { useDeployedContractInfo, useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { formatUsdc } from "~~/utils/scaffold-eth";

export function TreasuryStats() {
  const { data: routerInfo } = useDeployedContractInfo({ contractName: "PublicFundsRouter" });

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

  const { data: feeBps } = useScaffoldReadContract({
    contractName: "WageVault",
    functionName: "feeBps",
    watch: true,
  });

  const { data: totalOutstanding } = useScaffoldReadContract({
    contractName: "WageVault",
    functionName: "totalOutstanding",
    watch: true,
  });

  const { data: monBalance } = useScaffoldReadContract({
    contractName: "MockMON",
    functionName: "balanceOf",
    args: [routerInfo?.address],
    watch: true,
  });

  const { data: wethBalance } = useScaffoldReadContract({
    contractName: "MockWETH",
    functionName: "balanceOf",
    args: [routerInfo?.address],
    watch: true,
  });

  const sharePriceDisplay = sharePrice ? (Number(sharePrice) / 1e6).toFixed(6) : "1.000000";

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">Credit Vault</h2>
        <div className="flex flex-col gap-3">
          <div className="stat p-0">
            <div className="stat-title">Total Assets</div>
            <div className="stat-value text-lg">${formatUsdc(totalAssets)}</div>
          </div>
          <div className="stat p-0">
            <div className="stat-title">Currently Lent Out</div>
            <div className="stat-value text-lg text-warning">${formatUsdc(totalLentOut)}</div>
          </div>
          <div className="stat p-0">
            <div className="stat-title">Available Liquidity</div>
            <div className="stat-value text-lg text-success">${formatUsdc(availableLiquidity)}</div>
          </div>
          <div className="stat p-0">
            <div className="stat-title">Fees Collected</div>
            <div className="stat-value text-lg">${formatUsdc(totalFeesCollected)}</div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="opacity-70">Share Price:</span> <span className="font-mono">${sharePriceDisplay}</span>
            </div>
            <div>
              <span className="opacity-70">Fee Rate:</span>{" "}
              <span className="font-mono">{feeBps ? `${Number(feeBps) / 100}%` : "..."}</span>
            </div>
          </div>
          <div className="divider text-xs opacity-50 my-1">Router Assets</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="opacity-70">Outstanding:</span>{" "}
              <span className="font-mono">${formatUsdc(totalOutstanding)}</span>
            </div>
            <div>
              <span className="opacity-70">MON:</span> <span className="font-mono">{formatUsdc(monBalance)}</span>
            </div>
            <div>
              <span className="opacity-70">WETH:</span> <span className="font-mono">{formatUsdc(wethBalance)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
