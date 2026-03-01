"use client";

import { useState } from "react";
import { AddressInput } from "@scaffold-ui/components";
import { parseUnits } from "viem";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

export function RegisterEmployee() {
  const [employeeAddress, setEmployeeAddress] = useState("");
  const [salary, setSalary] = useState("");
  const [payPeriodDays, setPayPeriodDays] = useState("14");
  const [nextPayDate, setNextPayDate] = useState("");
  const [registering, setRegistering] = useState(false);

  const { writeContractAsync } = useScaffoldWriteContract({
    contractName: "PayrollRegistry",
  });

  const handleRegister = async () => {
    if (!employeeAddress || !salary || !payPeriodDays || !nextPayDate) {
      notification.error("All fields are required");
      return;
    }

    setRegistering(true);
    try {
      const nextPayTimestamp = BigInt(Math.floor(new Date(nextPayDate).getTime() / 1000));
      await writeContractAsync({
        functionName: "registerEmployee",
        args: [employeeAddress, parseUnits(salary, 6), BigInt(payPeriodDays), nextPayTimestamp],
      });
      notification.success("Employee registered!");
      setEmployeeAddress("");
      setSalary("");
      setPayPeriodDays("14");
      setNextPayDate("");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Registration failed";
      notification.error(msg);
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">Register Employee</h2>
        <p className="text-sm opacity-70">
          Manually register an employee. Employees can also self-register via the mock paystub upload on the Wage Credit
          page.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <div className="md:col-span-2">
            <label className="label">
              <span className="label-text">Employee Address</span>
            </label>
            <AddressInput value={employeeAddress} onChange={setEmployeeAddress} placeholder="0x..." />
          </div>
          <div>
            <label className="label">
              <span className="label-text">Salary per Period (USDC)</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder="5000"
              value={salary}
              onChange={e => setSalary(e.target.value)}
            />
          </div>
          <div>
            <label className="label">
              <span className="label-text">Pay Period (days)</span>
            </label>
            <input
              type="number"
              className="input input-bordered w-full"
              placeholder="14"
              value={payPeriodDays}
              onChange={e => setPayPeriodDays(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className="label">
              <span className="label-text">Next Pay Date</span>
            </label>
            <input
              type="datetime-local"
              className="input input-bordered w-full"
              value={nextPayDate}
              onChange={e => setNextPayDate(e.target.value)}
            />
          </div>
        </div>
        <button className="btn btn-primary mt-4" onClick={handleRegister} disabled={registering}>
          {registering ? <span className="loading loading-spinner loading-sm" /> : "Register Employee"}
        </button>
      </div>
    </div>
  );
}
