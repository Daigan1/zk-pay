"use client";

import { useCallback, useEffect, useState } from "react";
import { useUnlink } from "@unlink-xyz/react";
import { useAccount } from "wagmi";
import { usePrivacy } from "~~/components/PrivacyProvider";
import { useDeployedContractInfo, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

/** Shield 1 USDC into the private pool — enough for many privacy-ticket spends */
const SHIELD_AMOUNT = 1_000_000n; // 1 USDC (6 decimals)

/**
 * Auto-initializes the Unlink wallet, creates an account, and prompts the
 * user to shield USDC into their private balance when in privacy mode.
 * No-ops silently when privacy is not available (Anvil).
 */
export function UnlinkWalletInit() {
  const { isPrivacyAvailable } = usePrivacy();

  if (!isPrivacyAvailable) return null;

  return <WalletInitInner />;
}

function WalletInitInner() {
  const { ready, walletExists, activeAccount, createWallet, createAccount, deposit, busy } = useUnlink();
  const { address } = useAccount();
  const { data: usdcInfo } = useDeployedContractInfo({ contractName: "MockUSDC" });
  const { writeContractAsync: writeMint } = useScaffoldWriteContract({
    contractName: "MockUSDC",
    disableSimulate: true,
  });
  const [initStatus, setInitStatus] = useState<string | null>(null);
  const [needsShield, setNeedsShield] = useState(false);
  const [shielding, setShielding] = useState(false);

  // Step 1: Create wallet if needed
  useEffect(() => {
    if (ready && !walletExists && !busy) {
      setInitStatus("Creating Unlink wallet...");
      createWallet().catch(() => setInitStatus("Wallet init failed"));
    }
  }, [ready, walletExists, busy, createWallet]);

  // Step 2: Create account once wallet exists
  useEffect(() => {
    if (walletExists && !activeAccount && !busy) {
      setInitStatus("Creating account...");
      createAccount()
        .then(() => {
          setInitStatus(null);
          setNeedsShield(true);
        })
        .catch(() => setInitStatus("Account init failed"));
    }
  }, [walletExists, activeAccount, busy, createAccount]);

  // Clear status when fully initialized (returning user)
  useEffect(() => {
    if (activeAccount) setInitStatus(null);
  }, [activeAccount]);

  const handleShield = useCallback(async () => {
    if (!address || !deposit || !usdcInfo?.address) return;
    setShielding(true);
    try {
      // Mint 1 USDC to the user (mock-only: simulates having USDC)
      await writeMint({ functionName: "mint", args: [address, SHIELD_AMOUNT] });
      // Approve Unlink to pull USDC for shielding
      await writeMint({ functionName: "approve", args: [usdcInfo.address, SHIELD_AMOUNT] });
      // Shield into private balance
      await deposit([{ token: usdcInfo.address, amount: SHIELD_AMOUNT, depositor: address }]);
      notification.success("1 USDC shielded! Private transactions are ready.");
      setNeedsShield(false);
    } catch (e: unknown) {
      notification.error(e instanceof Error ? e.message : "Shield failed");
    } finally {
      setShielding(false);
    }
  }, [address, deposit, usdcInfo, writeMint]);

  // Show shield prompt for new accounts
  if (needsShield && activeAccount) {
    return (
      <div className="fixed bottom-4 right-4 bg-base-100 border border-base-300 px-4 py-3 rounded-lg shadow-lg text-sm z-50 max-w-xs">
        <p className="font-bold mb-1">Shield USDC for Privacy</p>
        <p className="opacity-70 text-xs mb-2">
          Deposit 1 USDC into your private balance to enable shielded transactions. This is minted for free on testnet.
        </p>
        <div className="flex gap-2">
          <button className="btn btn-primary btn-xs" onClick={handleShield} disabled={shielding}>
            {shielding ? <span className="loading loading-spinner loading-xs" /> : "Shield USDC"}
          </button>
          <button className="btn btn-ghost btn-xs" onClick={() => setNeedsShield(false)}>
            Later
          </button>
        </div>
      </div>
    );
  }

  if (!initStatus) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-base-200 px-4 py-2 rounded-lg shadow-lg text-sm z-50">
      <span className="loading loading-spinner loading-xs mr-2" />
      {initStatus}
    </div>
  );
}
