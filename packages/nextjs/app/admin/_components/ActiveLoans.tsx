"use client";

import { useMemo, useState } from "react";
import { Address } from "@scaffold-ui/components";
import { useScaffoldEventHistory, useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { usePrivateInteract } from "~~/hooks/scaffold-eth/usePrivateInteract";
import { formatUsdc, notification } from "~~/utils/scaffold-eth";

function LoanRow({ employee }: { employee: string }) {
  const [plaidStatus, setPlaidStatus] = useState<string | null>(null);
  const [settling, setSettling] = useState(false);

  const { data: loan, isLoading } = useScaffoldReadContract({
    contractName: "WageVault",
    functionName: "getLoan",
    args: [employee],
    watch: true,
  });

  const { interact: writeVault } = usePrivateInteract("WageVault");
  const isPending = settling;

  if (isLoading) {
    return (
      <tr>
        <td colSpan={5} className="text-center">
          <span className="loading loading-spinner loading-sm" />
        </td>
      </tr>
    );
  }

  if (!loan?.active) return null;

  const fee = BigInt(loan.fixedFee);
  const repayment = BigInt(loan.loanedAmount) + fee;

  const handleSettle = async () => {
    setSettling(true);
    try {
      await writeVault({ functionName: "settlePayment", args: [employee] });
      notification.success("Payment settled!");
    } catch (e: unknown) {
      notification.error(e instanceof Error ? e.message : "Settlement failed");
    } finally {
      setSettling(false);
    }
  };

  const handleClawback = async () => {
    setSettling(true);
    try {
      await writeVault({
        functionName: "clawbackLoan",
        args: [employee],
      });
      notification.success("Loan clawed back.");
    } catch (e: unknown) {
      notification.error(e instanceof Error ? e.message : "Clawback failed");
    } finally {
      setSettling(false);
    }
  };

  const handlePlaidSettle = async () => {
    try {
      setPlaidStatus("initiating");
      // Initiate ACH debit via Plaid
      const repaymentUsd = Number(repayment) / 1_000_000;
      const initRes = await fetch("/api/plaid/initiate-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee, amount: repaymentUsd.toFixed(2) }),
      });
      const initData = await initRes.json();

      if (!initRes.ok) {
        throw new Error(initData.error || "Failed to initiate payment");
      }

      setPlaidStatus("pending");
      // Poll transfer status
      const transferId = initData.transferId;
      let attempts = 0;
      const maxAttempts = 20;

      const poll = async (): Promise<string> => {
        const checkRes = await fetch("/api/plaid/check-transfer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transferId }),
        });
        const checkData = await checkRes.json();
        const status = checkData.status;

        if (status === "posted" || status === "settled") return "success";
        if (status === "failed" || status === "cancelled") return "failed";

        attempts++;
        if (attempts >= maxAttempts) return "timeout";

        await new Promise(r => setTimeout(r, 3000));
        return poll();
      };

      const result = await poll();

      if (result === "success") {
        setPlaidStatus("settling");
        await writeVault({ functionName: "settlePayment", args: [employee] });
        notification.success("Plaid payment received — loan settled!");
      } else {
        setPlaidStatus("clawing back");
        // Payment failed — clawback
        await writeVault({ functionName: "clawbackLoan", args: [employee] });
        notification.error("Plaid payment failed — loan clawed back.");
      }
    } catch (e: unknown) {
      notification.error(e instanceof Error ? e.message : "Plaid settlement failed");
    } finally {
      setPlaidStatus(null);
    }
  };

  return (
    <tr>
      <td>
        <Address address={employee} />
      </td>
      <td className="font-mono">${formatUsdc(loan.loanedAmount)}</td>
      <td className="font-mono">${formatUsdc(loan.fixedFee)}</td>
      <td className="font-mono font-bold">${formatUsdc(repayment)}</td>
      <td>{new Date(Number(loan.payDate) * 1000).toLocaleDateString()}</td>
      <td className="whitespace-nowrap">
        <div className="flex flex-wrap gap-1">
          <button className="btn btn-success btn-xs" onClick={handleSettle} disabled={isPending || !!plaidStatus}>
            {isPending ? <span className="loading loading-spinner loading-xs" /> : "Settle"}
          </button>
          <button className="btn btn-error btn-xs" onClick={handleClawback} disabled={isPending || !!plaidStatus}>
            Clawback
          </button>
          <button className="btn btn-info btn-xs" onClick={handlePlaidSettle} disabled={isPending || !!plaidStatus}>
            {plaidStatus ? (
              <span className="flex items-center gap-1">
                <span className="loading loading-spinner loading-xs" />
                {plaidStatus}
              </span>
            ) : (
              "Plaid"
            )}
          </button>
        </div>
      </td>
    </tr>
  );
}

export function ActiveLoans() {
  // Omit fromBlock so the hook uses WageVault's deployedOnBlock (~15.8M on monad-testnet).
  // Passing 0n forced scanning from genesis which overloaded the RPC.
  const { data: creditEvents, isLoading } = useScaffoldEventHistory({
    contractName: "WageVault",
    eventName: "CreditRequested",
    watch: true,
  });

  const uniqueEmployees = useMemo(() => {
    if (!creditEvents) return [];
    const seen = new Set<string>();
    return creditEvents
      .map(e => e.args.employee as string)
      .filter(addr => {
        if (!addr) return false;
        const lower = addr.toLowerCase();
        if (seen.has(lower)) return false;
        seen.add(lower);
        return true;
      });
  }, [creditEvents]);

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">Active Loans</h2>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <span className="loading loading-spinner" />
          </div>
        ) : uniqueEmployees.length === 0 ? (
          <p className="text-sm opacity-70">No credit requests found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Principal</th>
                  <th>Fee</th>
                  <th>Repayment</th>
                  <th>Pay Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {uniqueEmployees.map(emp => (
                  <LoanRow key={emp} employee={emp} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
