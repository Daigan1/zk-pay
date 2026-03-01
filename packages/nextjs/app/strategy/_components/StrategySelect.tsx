"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { usePrivacy } from "~~/components/PrivacyProvider";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { usePrivateInteract } from "~~/hooks/scaffold-eth/usePrivateInteract";
import { formatUsdc, notification } from "~~/utils/scaffold-eth";

type AiRecommendation = {
  usdcPct: number;
  monPct: number;
  wethPct: number;
  confidence: number;
  reasoning: string;
  x402?: { paid: boolean; amount: string; currency: string; protocol: string };
};

export function StrategySelect() {
  const { address } = useAccount();
  const { isPrivacyAvailable } = usePrivacy();

  const [usdcPct, setUsdcPct] = useState(100);
  const [monPct, setMonPct] = useState(0);
  const [wethPct, setWethPct] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const [mode, setMode] = useState<"manual" | "ai">("manual");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRec, setAiRec] = useState<AiRecommendation | null>(null);

  // -- Reads --
  const { data: loan } = useScaffoldReadContract({
    contractName: "WageVault",
    functionName: "getLoan",
    args: [address],
    watch: true,
  });

  const { data: allocation } = useScaffoldReadContract({
    contractName: "WageVault",
    functionName: "getAllocation",
    args: [address],
    watch: true,
  });

  const { data: position } = useScaffoldReadContract({
    contractName: "WageVault",
    functionName: "getPosition",
    args: [address],
    watch: true,
  });

  const { data: wusdcBalance } = useScaffoldReadContract({
    contractName: "WageToken",
    functionName: "balanceOf",
    args: [address],
    watch: true,
  });

  // -- Write --
  const { interact: writeContractAsync, isPending } = usePrivateInteract("WageVault");

  // Sync sliders with on-chain allocation on first load
  useEffect(() => {
    if (allocation && !initialized) {
      setUsdcPct(Number(allocation.usdcBps) / 100);
      setMonPct(Number(allocation.monBps) / 100);
      setWethPct(Number(allocation.wethBps) / 100);
      setInitialized(true);
    }
  }, [allocation, initialized]);

  // Adjust other sliders when one changes to keep sum at 100
  const handleSliderChange = useCallback(
    (token: "usdc" | "mon" | "weth", value: number) => {
      const clamped = Math.min(100, Math.max(0, Math.round(value)));

      if (token === "usdc") {
        const remaining = 100 - clamped;
        const oldOtherSum = monPct + wethPct;
        if (oldOtherSum === 0) {
          setUsdcPct(clamped);
          setMonPct(remaining);
          setWethPct(0);
        } else {
          setUsdcPct(clamped);
          const newMon = Math.round((monPct / oldOtherSum) * remaining);
          setMonPct(newMon);
          setWethPct(remaining - newMon);
        }
      } else if (token === "mon") {
        const remaining = 100 - clamped;
        const oldOtherSum = usdcPct + wethPct;
        if (oldOtherSum === 0) {
          setMonPct(clamped);
          setUsdcPct(remaining);
          setWethPct(0);
        } else {
          setMonPct(clamped);
          const newUsdc = Math.round((usdcPct / oldOtherSum) * remaining);
          setUsdcPct(newUsdc);
          setWethPct(remaining - newUsdc);
        }
      } else {
        const remaining = 100 - clamped;
        const oldOtherSum = usdcPct + monPct;
        if (oldOtherSum === 0) {
          setWethPct(clamped);
          setUsdcPct(remaining);
          setMonPct(0);
        } else {
          setWethPct(clamped);
          const newUsdc = Math.round((usdcPct / oldOtherSum) * remaining);
          setUsdcPct(newUsdc);
          setMonPct(remaining - newUsdc);
        }
      }
    },
    [usdcPct, monPct, wethPct],
  );

  const handleSubmit = async () => {
    try {
      await writeContractAsync({
        functionName: "setAllocation",
        args: [Math.round(usdcPct * 100), Math.round(monPct * 100), Math.round(wethPct * 100), address],
      });
      notification.success("Allocation updated!");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to set allocation";
      notification.error(msg);
    }
  };

  const handleAiRecommend = async () => {
    setAiLoading(true);
    setAiRec(null);
    try {
      const res = await fetch("/api/strategy/ai-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentAllocation: { usdc: usdcPct, mon: monPct, weth: wethPct } }),
      });
      if (!res.ok) throw new Error("AI agent request failed");
      const data: AiRecommendation = await res.json();
      setAiRec(data);
    } catch (e: unknown) {
      notification.error(e instanceof Error ? e.message : "AI recommendation failed");
    } finally {
      setAiLoading(false);
    }
  };

  const applyRecommendation = () => {
    if (!aiRec) return;
    setUsdcPct(aiRec.usdcPct);
    setMonPct(aiRec.monPct);
    setWethPct(aiRec.wethPct);
    notification.success("Recommendation applied to sliders. Click 'Update Allocation' to submit on-chain.");
  };

  const hasChanged =
    allocation &&
    (usdcPct !== Number(allocation.usdcBps) / 100 ||
      monPct !== Number(allocation.monBps) / 100 ||
      wethPct !== Number(allocation.wethBps) / 100);

  const hasActiveLoan = loan?.active ?? false;

  if (!address) {
    return (
      <div className="flex flex-col items-center pt-20 gap-4">
        <h1 className="text-3xl font-bold">Fund Allocation</h1>
        <p className="text-lg opacity-70">Connect your wallet to manage your allocation.</p>
      </div>
    );
  }

  if (!hasActiveLoan) {
    return (
      <div className="flex flex-col items-center pt-20 gap-4">
        <h1 className="text-3xl font-bold">Fund Allocation</h1>
        <p className="text-lg opacity-70">You need an active wage credit position to set an allocation.</p>
        <Link href="/wage-credit" className="btn btn-primary">
          Get Wage Credit
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center pt-10 gap-6 px-5 pb-10">
      <h1 className="text-3xl font-bold">Fund Allocation</h1>

      {/* Current Position */}
      <div className="card bg-base-100 shadow-xl w-full max-w-lg">
        <div className="card-body">
          <h2 className="card-title">Your Position</h2>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <span className="opacity-70">wUSDC Allocation</span>
            <span className="text-right font-mono">
              {formatUsdc(isPrivacyAvailable && loan?.active ? loan.loanedAmount : wusdcBalance)} wUSDC
            </span>
            <span className="opacity-70">USDC Held</span>
            <span className="text-right font-mono">
              {formatUsdc(position?.usdcAmount)}
              <span className="text-xs opacity-50 ml-1">(earning ~5% APY)</span>
            </span>
            <span className="opacity-70">MON Held</span>
            <span className="text-right font-mono">{formatUsdc(position?.monAmount)}</span>
            <span className="opacity-70">WETH Held</span>
            <span className="text-right font-mono">{formatUsdc(position?.wethAmount)}</span>
          </div>
          {loan && loan.active && (
            <div className="mt-3 p-3 bg-base-200 rounded-lg text-sm">
              <div className="flex justify-between">
                <span className="opacity-70">Principal</span>
                <span className="font-mono">${formatUsdc(loan.loanedAmount)}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="opacity-70">Fixed Fee</span>
                <span className="font-mono">${formatUsdc(loan.fixedFee)}</span>
              </div>
              <div className="flex justify-between mt-1 font-bold">
                <span>Repayment Due</span>
                <span className="font-mono">${formatUsdc(BigInt(loan.loanedAmount) + BigInt(loan.fixedFee))}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Strategy Mode Toggle */}
      <div className="card bg-base-100 shadow-xl w-full max-w-lg">
        <div className="card-body">
          <div className="flex justify-between items-center mb-2">
            <h2 className="card-title">Set Allocation</h2>
            <div className="tabs tabs-boxed">
              <button
                className={`tab tab-sm ${mode === "manual" ? "tab-active" : ""}`}
                onClick={() => setMode("manual")}
              >
                Manual
              </button>
              <button className={`tab tab-sm ${mode === "ai" ? "tab-active" : ""}`} onClick={() => setMode("ai")}>
                AI Agent
              </button>
            </div>
          </div>

          {mode === "ai" && (
            <div className="mb-4">
              <p className="text-sm opacity-70 mb-3">
                Let the AI agent analyze market conditions and recommend an optimal allocation. The agent pays for
                strategy advice via the x402 protocol.
              </p>
              <button className="btn btn-secondary btn-sm" onClick={handleAiRecommend} disabled={aiLoading}>
                {aiLoading ? (
                  <span className="flex items-center gap-1">
                    <span className="loading loading-spinner loading-xs" />
                    Analyzing...
                  </span>
                ) : (
                  "Get AI Recommendation"
                )}
              </button>

              {aiRec && (
                <div className="mt-3 p-3 bg-base-200 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-sm">Recommendation</span>
                    <span className="badge badge-primary badge-sm">
                      {Math.round(aiRec.confidence * 100)}% confidence
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-sm mb-2">
                    <div>
                      <div className="font-mono font-bold">{aiRec.usdcPct}%</div>
                      <div className="opacity-70 text-xs">USDC</div>
                    </div>
                    <div>
                      <div className="font-mono font-bold">{aiRec.monPct}%</div>
                      <div className="opacity-70 text-xs">MON</div>
                    </div>
                    <div>
                      <div className="font-mono font-bold">{aiRec.wethPct}%</div>
                      <div className="opacity-70 text-xs">WETH</div>
                    </div>
                  </div>
                  <p className="text-xs opacity-70 italic">{aiRec.reasoning}</p>
                  {aiRec.x402 && (
                    <p className="text-xs opacity-50 mt-1">
                      Paid {aiRec.x402.amount} {aiRec.x402.currency} via {aiRec.x402.protocol}
                    </p>
                  )}
                  <button className="btn btn-primary btn-sm mt-2 w-full" onClick={applyRecommendation}>
                    Apply Recommendation
                  </button>
                </div>
              )}
            </div>
          )}

          {mode === "manual" && (
            <p className="text-sm opacity-70 mb-2">Drag sliders to allocate your position. Must total 100%.</p>
          )}

          {/* USDC */}
          <div className="flex items-center gap-3">
            <span className="w-14 text-sm font-bold">USDC</span>
            <input
              type="range"
              min={0}
              max={100}
              value={usdcPct}
              onChange={e => handleSliderChange("usdc", Number(e.target.value))}
              className="range range-primary flex-1"
            />
            <span className="w-12 text-right font-mono text-sm">{usdcPct}%</span>
          </div>

          {/* MON */}
          <div className="flex items-center gap-3">
            <span className="w-14 text-sm font-bold">MON</span>
            <input
              type="range"
              min={0}
              max={100}
              value={monPct}
              onChange={e => handleSliderChange("mon", Number(e.target.value))}
              className="range range-primary flex-1"
            />
            <span className="w-12 text-right font-mono text-sm">{monPct}%</span>
          </div>

          {/* WETH */}
          <div className="flex items-center gap-3">
            <span className="w-14 text-sm font-bold">WETH</span>
            <input
              type="range"
              min={0}
              max={100}
              value={wethPct}
              onChange={e => handleSliderChange("weth", Number(e.target.value))}
              className="range range-primary flex-1"
            />
            <span className="w-12 text-right font-mono text-sm">{wethPct}%</span>
          </div>

          <button className="btn btn-primary mt-4" onClick={handleSubmit} disabled={isPending || !hasChanged}>
            {isPending ? <span className="loading loading-spinner loading-sm" /> : "Update Allocation"}
          </button>
        </div>
      </div>
    </div>
  );
}
