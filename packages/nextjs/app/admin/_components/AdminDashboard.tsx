"use client";

import { ActiveLoans } from "./ActiveLoans";
import { FundTreasury } from "./FundTreasury";
import { RegisterEmployee } from "./RegisterEmployee";
import { TreasuryStats } from "./TreasuryStats";
import { useAccount } from "wagmi";
import { usePrivacy } from "~~/components/PrivacyProvider";
import { ShieldUsdcButton } from "~~/components/ShieldUsdcButton";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

export function AdminDashboard() {
  const { address } = useAccount();
  const { isPrivacyAvailable } = usePrivacy();

  const {
    data: owner,
    isLoading: ownerLoading,
    isError: ownerError,
  } = useScaffoldReadContract({
    contractName: "WageVault",
    functionName: "owner",
    watch: true,
  });

  if (!address) {
    return (
      <div className="flex flex-col items-center pt-20 gap-4">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-lg opacity-70">Connect your wallet to access admin functions.</p>
      </div>
    );
  }

  if (ownerLoading) {
    return (
      <div className="flex flex-col items-center pt-20 gap-4">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (ownerError || !owner) {
    return (
      <div className="flex flex-col items-center pt-20 gap-4">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <div className="alert alert-error max-w-lg">
          <span>Failed to verify contract ownership. Please check your network connection.</span>
        </div>
      </div>
    );
  }

  const isOwner = address.toLowerCase() === owner.toLowerCase();

  if (!isOwner) {
    return (
      <div className="flex flex-col items-center pt-20 gap-4">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <div className="alert alert-warning max-w-lg">
          <span>You are not the contract owner. Admin functions are restricted.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center pt-10 gap-6 px-5 pb-10">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>

      {isPrivacyAvailable && (
        <div className="w-full max-w-4xl rounded-box border border-info/30 bg-info/10 p-4 text-sm text-base-content flex flex-col gap-2">
          <span>Privacy mode active. Shield USDC to enable private settle/clawback.</span>
          <ShieldUsdcButton />
        </div>
      )}

      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TreasuryStats />
        <FundTreasury />
        <div className="lg:col-span-2">
          <RegisterEmployee />
        </div>
        <div className="lg:col-span-2">
          <ActiveLoans />
        </div>
      </div>
    </div>
  );
}
