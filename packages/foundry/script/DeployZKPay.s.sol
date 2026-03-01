// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import "../contracts/MockUSDC.sol";
import "../contracts/MockMON.sol";
import "../contracts/MockWETH.sol";
import "../contracts/WageToken.sol";
import "../contracts/PayrollRegistry.sol";
import "../contracts/PublicFundsRouter.sol";
import "../contracts/CreditVault.sol";
import "../contracts/MockYieldVault.sol";
import "../contracts/WageVault.sol";

/**
 * @notice Deploy all ZK-Pay v3 contracts in dependency order.
 *
 *         Deployment order:
 *         1. MockUSDC, MockMON, MockWETH  — no deps
 *         2. PayrollRegistry              — no deps (owner = deployer)
 *         3. WageToken                    — owner transferred to WageVault
 *         4. PublicFundsRouter            — holds multi-asset positions
 *         5. CreditVault                  — lender-facing USDC vault
 *         6. WageVault                    — depends on all above
 *
 *         Post-deploy wiring:
 *         - Router.setVault(vault)
 *         - CreditVault.setVault(vault)
 *         - WageToken.transferOwnership(vault)
 *         - Registry.authorize(vault)
 *
 *         On Anvil: seeds CreditVault with 10,000 USDC (simulating lender deposit).
 *
 *         Run: yarn deploy --file DeployZKPay.s.sol
 */
contract DeployZKPay is ScaffoldETHDeploy {
    function run() external ScaffoldEthDeployerRunner {
        // 1. Mock tokens
        MockUSDC usdc = new MockUSDC();
        deployments.push(Deployment({ name: "MockUSDC", addr: address(usdc) }));

        MockMON mon = new MockMON();
        deployments.push(Deployment({ name: "MockMON", addr: address(mon) }));

        MockWETH weth = new MockWETH();
        deployments.push(Deployment({ name: "MockWETH", addr: address(weth) }));

        // 2. PayrollRegistry (deployer is the employer/admin)
        PayrollRegistry registry = new PayrollRegistry(deployer);
        deployments.push(Deployment({ name: "PayrollRegistry", addr: address(registry) }));

        // 3. WageToken — initialOwner is deployer, transferred to vault below.
        WageToken wageToken = new WageToken(deployer);
        deployments.push(Deployment({ name: "WageToken", addr: address(wageToken) }));

        // 4. PublicFundsRouter — holds USDC/MON/WETH positions.
        PublicFundsRouter router = new PublicFundsRouter(address(usdc), address(mon), address(weth));
        deployments.push(Deployment({ name: "PublicFundsRouter", addr: address(router) }));

        // 5. CreditVault — lender-facing vault for USDC liquidity.
        CreditVault creditVault = new CreditVault(address(usdc), deployer);
        deployments.push(Deployment({ name: "CreditVault", addr: address(creditVault) }));

        // 6. WageVault — core protocol contract.
        //    feeBps = 100 (1% flat fee per period)
        WageVault vault = new WageVault(
            address(router),
            address(usdc),
            address(wageToken),
            address(registry),
            address(mon),
            address(weth),
            address(creditVault),
            100, // 1% fee
            deployer
        );
        deployments.push(Deployment({ name: "WageVault", addr: address(vault) }));

        // 7. MockYieldVault — auto-yield on idle USDC (Anvil only).
        MockYieldVault yieldVault = new MockYieldVault(address(usdc));
        deployments.push(Deployment({ name: "MockYieldVault", addr: address(yieldVault) }));

        // Wire: router accepts calls only from vault.
        router.setVault(address(vault));

        // Wire: router auto-stakes USDC into yield vault.
        router.setYieldVault(address(yieldVault));

        // Wire: CreditVault accepts draws/repayments only from vault.
        creditVault.setVault(address(vault));

        // Transfer WageToken ownership to vault so only vault can mint/burn.
        wageToken.transferOwnership(address(vault));

        // Authorize vault to call advancePayDate/removeEmployee on the registry.
        registry.authorize(address(vault));

        // On monad-testnet: register the Unlink adapter and pool so privacy-mode
        // interact calls pass the employeeOrAdapter modifier.
        // The adapter dispatches calls, but the pool may also be in the call path.
        if (block.chainid == 10143) {
            vault.setAdapter(0xf1855BCD3100A99413FA05edB1BDFca9d2d98265);
            vault.setAuthorizedCaller(0x0813DA0a10328e5ed617D37e514ac2f6fA49A254, true); // Unlink pool
        }

        // Seed CreditVault with 10,000 USDC so employees can draw credit.
        // On Anvil this simulates a lender; on testnet it bootstraps the demo.
        {
            uint256 seedAmount = 10_000 * 1e6; // 10,000 USDC (6 decimals)
            usdc.mint(deployer, seedAmount);
            usdc.approve(address(creditVault), seedAmount);
            creditVault.deposit(seedAmount);

            // Give admin USDC for settlement fees (simulates employer payroll funding).
            usdc.mint(deployer, 10_000 * 1e6);
        }
    }
}
