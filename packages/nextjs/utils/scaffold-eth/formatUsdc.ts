import { formatUnits } from "viem";

export const formatUsdc = (amount: bigint | undefined) => {
  if (amount === undefined) return "...";
  return Number(formatUnits(amount, 6)).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};
