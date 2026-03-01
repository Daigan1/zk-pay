import { NextResponse } from "next/server";

// Simple strategy recommendation engine
// In production, this would call a real AI model or external API
function generateRecommendation() {
  // Simple momentum-based heuristic for demo
  const strategies = [
    {
      usdcPct: 40,
      monPct: 35,
      wethPct: 25,
      reasoning: "Balanced growth: moderate stablecoin safety with exposure to MON and WETH upside.",
    },
    {
      usdcPct: 60,
      monPct: 25,
      wethPct: 15,
      reasoning: "Conservative: majority stablecoin yield with small crypto exposure for upside.",
    },
    {
      usdcPct: 20,
      monPct: 50,
      wethPct: 30,
      reasoning: "Aggressive growth: heavy MON allocation given Monad ecosystem momentum.",
    },
    {
      usdcPct: 50,
      monPct: 30,
      wethPct: 20,
      reasoning: "Moderate: half in yield-bearing USDC, balanced crypto exposure.",
    },
  ];

  const pick = strategies[Math.floor(Math.random() * strategies.length)];
  const confidence = 0.7 + Math.random() * 0.25; // 70-95%

  return {
    ...pick,
    confidence: Math.round(confidence * 100) / 100,
  };
}

export async function POST(req: Request) {
  try {
    await req.json(); // consume body

    const recommendation = generateRecommendation();

    return NextResponse.json(recommendation);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Recommendation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
