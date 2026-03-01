"use client";

import { useMemo } from "react";
import { UnlinkProvider, useUnlink } from "@unlink-xyz/react";
import { PrivacyContext } from "~~/components/PrivacyProvider";

/**
 * Wraps children with UnlinkProvider for monad-testnet and bridges
 * the Unlink interact + deposit functions into the PrivacyContext so that
 * usePrivateInteract can access them without calling Unlink hooks directly.
 *
 * This component is lazy-loaded by PrivacyProvider to avoid bundling
 * the Unlink SDK when running on Anvil (public mode).
 */
export function UnlinkProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <UnlinkProvider chain="monad-testnet" autoSync syncInterval={30_000}>
      <InteractBridge>{children}</InteractBridge>
    </UnlinkProvider>
  );
}

/** Bridges Unlink's raw SDK functions into PrivacyContext.
 *  Uses useUnlink() directly (not useInteract mutation hook) so that
 *  errors propagate to callers instead of being swallowed. */
function InteractBridge({ children }: { children: React.ReactNode }) {
  const { interact, busy, deposit, balances, refresh, waitForConfirmation } = useUnlink();

  const value = useMemo(
    () => ({
      isPrivacyAvailable: true as const,
      unlinkInteract: interact,
      unlinkInteractPending: busy,
      unlinkDeposit: deposit,
      unlinkBalances: balances,
      unlinkRefresh: refresh,
      unlinkWaitForConfirmation: waitForConfirmation,
    }),
    [interact, busy, deposit, balances, refresh, waitForConfirmation],
  );

  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}
