"use client";

import Link from "next/link";
import { Address } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { hardhat } from "viem/chains";
import { useAccount } from "wagmi";
import { BanknotesIcon, BuildingLibraryIcon, ChartBarIcon } from "@heroicons/react/24/outline";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const { targetNetwork } = useTargetNetwork();

  return (
    <div className="flex items-center flex-col grow pt-16 px-5">
      <div className="max-w-2xl text-center mb-16">
        <h1 className="text-5xl font-bold tracking-loose">
          Private Wage-Backed
          <span className="text-primary block mt-2">Lending</span>
        </h1>
        <p className="text-lg text-white/80 max-w-xl mx-auto">
          Unlock early wage access backed by verified payroll. Zero-knowledge proofs keep your income data private.
        </p>
      </div>

      {connectedAddress && (
        <div className="mb-12 flex flex-col items-center gap-2">
          <span className="text-sm text-white/60">Connected as</span>
          <Address
            style={{ color: "white" }}
            address={connectedAddress}
            chain={targetNetwork}
            blockExplorerAddressLink={
              targetNetwork.id === hardhat.id ? `/blockexplorer/address/${connectedAddress}` : undefined
            }
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full mb-16">
        <Link
          href="/wage-credit"
          className="card bg-base-100 border border-base-300 p-6 hover:border-primary/50 transition-colors cursor-pointer"
        >
          <BanknotesIcon className="h-8 w-8 text-primary mb-3" />
          <h3 className="font-semibold text-lg mb-1 text-white">Wage Credit</h3>
          <p className="text-sm text-white/70">Verify your income and draw against upcoming pay.</p>
        </Link>

        <Link
          href="/strategy"
          className="card bg-base-100 border border-base-300 p-6 hover:border-primary/50 transition-colors cursor-pointer"
        >
          <ChartBarIcon className="h-8 w-8 text-primary mb-3" />
          <h3 className="font-semibold text-lg mb-1 text-white">Strategy</h3>
          <p className="text-sm text-white/70">Allocate credit across USDC, MON, and WETH.</p>
        </Link>

        <Link
          href="/lend"
          className="card bg-base-100 border border-base-300 p-6 hover:border-primary/50 transition-colors cursor-pointer"
        >
          <BuildingLibraryIcon className="h-8 w-8 text-primary mb-3" />
          <h3 className="font-semibold text-lg mb-1 text-white">Lend</h3>
          <p className="text-sm text-white/70">Deposit USDC to earn fixed fees from wage-backed lending.</p>
        </Link>
      </div>
    </div>
  );
};

export default Home;
