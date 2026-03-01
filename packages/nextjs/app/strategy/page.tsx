import { StrategySelect } from "./_components/StrategySelect";
import type { NextPage } from "next";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const metadata = getMetadata({
  title: "Strategy",
  description: "Allocate your wage credit across USDC, MON, and WETH",
});

const StrategyPage: NextPage = () => {
  return <StrategySelect />;
};

export default StrategyPage;
