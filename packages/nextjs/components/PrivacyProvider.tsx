"use client";

import { createContext, useContext, useMemo } from "react";
import dynamic from "next/dynamic";
import type { InteractResult, SimpleInteractParams } from "@unlink-xyz/react";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";

// Chain IDs where Unlink is available
const UNLINK_CHAIN_IDS = new Set([10143]); // monad-testnet

type PrivacyContextType = {
  isPrivacyAvailable: boolean;
  /** Unlink interact function — only available in privacy mode */
  unlinkInteract: ((params: SimpleInteractParams) => Promise<InteractResult>) | null;
  unlinkInteractPending: boolean;
  /** Unlink deposit function for shielding tokens */

  unlinkDeposit: ((...args: any[]) => Promise<any>) | null;
  /** Shielded token balances (token address -> amount) */
  unlinkBalances: Record<string, bigint>;
  /** Force refresh notes and balances from the relay */
  unlinkRefresh: (() => Promise<void>) | null;
  /** Wait for a relay transaction to reach terminal state */
  unlinkWaitForConfirmation: ((relayId: string) => Promise<unknown>) | null;
};

const PrivacyContext = createContext<PrivacyContextType>({
  isPrivacyAvailable: false,
  unlinkInteract: null,
  unlinkInteractPending: false,
  unlinkDeposit: null,
  unlinkBalances: {},
  unlinkRefresh: null,
  unlinkWaitForConfirmation: null,
});

export const usePrivacy = () => useContext(PrivacyContext);

// Lazy-load UnlinkProvider + interact bridge only when privacy is available
const UnlinkProviderLazy = dynamic(
  () => import("./UnlinkProviderWrapper").then(mod => ({ default: mod.UnlinkProviderWrapper })),
  { ssr: false },
);

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const { targetNetwork } = useTargetNetwork();
  const isPrivacyAvailable = UNLINK_CHAIN_IDS.has(targetNetwork.id);

  if (isPrivacyAvailable) {
    return <UnlinkProviderLazy>{children}</UnlinkProviderLazy>;
  }

  return <PublicModeProvider>{children}</PublicModeProvider>;
}

function PublicModeProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo(
    () => ({
      isPrivacyAvailable: false as const,
      unlinkInteract: null,
      unlinkInteractPending: false,
      unlinkDeposit: null,
      unlinkBalances: {},
      unlinkRefresh: null,
      unlinkWaitForConfirmation: null,
    }),
    [],
  );
  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}

// Re-export the context for the wrapper to provide values
export { PrivacyContext };
