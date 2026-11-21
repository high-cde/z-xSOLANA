// Deploy di VelvetPayTest su Polygon Amoy (chainId 80002). Rifiuta qualsiasi altra rete. Uso: node deploy-amoy.mjs
import fs from "fs"; import { ethers } from "ethers";
const RPC = process.env.AMOY_RPC || "https://polygon-amoy-bor-rpc.publicnode.com";
const provider = new ethers.JsonRpcProvider(RPC); const net = await provider.getNetwork();
if (net.chainId !== 80002n) { console.error("rete non Amoy:", net.chainId); process.exit(3); }
const wallet = new ethers.Wallet(JSON.parse(fs.readFileSync("./amoy-deployer-keypair.json", "utf8")).privateKey, provider);
const bal = await provider.getBalance(wallet.address); console.log("deployer", wallet.address, ethers.formatEther(bal), "POL (Amoy)");
if (bal < ethers.parseEther("0.02")) { console.error("servono almeno 0,02 POL di test su Amoy"); process.exit(4); }
const { abi, bytecode } = JSON.parse(fs.readFileSync("./VelvetPayTest.json", "utf8"));
const c = await new ethers.ContractFactory(abi, bytecode, wallet).deploy(ethers.parseUnits("100000000", 18)); await c.waitForDeployment();
const out = { chainId: 80002, address: await c.getAddress(), tx: c.deploymentTransaction().hash, deployer: wallet.address, decimals: 18, symbol: "VPAY" };
fs.writeFileSync("./amoy-deploy.json", JSON.stringify(out, null, 2)); console.log(out);
