"use client";

import React, { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, HelpCircle, Flame, Shield, Pause, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import { Coins } from "@/components/ui/icons";
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { normalizeSuiObjectId } from "@mysten/sui/utils";
import { useRouter } from "next/navigation";
import { useUpdatePRegCoin, useUpdateURegCoin } from "../hooks/updateCoin";

interface TokenFormRegulatedProps {
  network: "mainnet" | "testnet" | "devnet";
  onBack: () => void;
  onSwitchTemplate: (templateId: "standard" | "closed-loop") => void;
}

interface TokenData {
  name: string;
  symbol: string;
  description: string;
  decimal: string;
  newPkgId: string;
  txId: string;
  owner: string;
  treasuryCap: string;
  denyCap: string | undefined;
  metadata: string | undefined;
  type: "regulated";
  features: {
    burnable: boolean;
    mintable: boolean;
    pausable: boolean;
    denylist: boolean;
  };
}

export default function TokenFormRegulated({ network, onBack, onSwitchTemplate }: TokenFormRegulatedProps) {
  const router = useRouter();
  const { toast } = useToast();
  const suiClient = useSuiClient();
  const updatePRegCoin = useUpdatePRegCoin;
  const updateURegCoin = useUpdateURegCoin;
  const account = useCurrentAccount();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const [formData, setFormData] = useState({
    tokenName: "",
    tokenSymbol: "",
    description: "",
    decimals: "9",
    initialSupply: "",
    maxSupply: "",
  });
  const [features, setFeatures] = useState({
    burnable: true,
    mintable: true,
    pausable: true,
    denylist: true,
  });
  const [customDecimals, setCustomDecimals] = useState(false);
  const [isCreatingToken, setIsCreatingToken] = useState(false);
  const [tokenData, setTokenData] = useState<TokenData | null>(null);

  const getNetworkName = () => {
    const networkNames: Record<string, string> = {
      mainnet: "Sui Mainnet",
      testnet: "Sui Testnet",
      devnet: "Sui Devnet",
    };
    return networkNames[network] || "Sui";
  };

  const handleInputChange = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleFeatureChange = (feature: keyof typeof features) => (checked: boolean) => {
    setFeatures((prev) => ({ ...prev, [feature]: checked }));
  };

  const validateForm = () => {
    const { tokenName, tokenSymbol, description, decimals } = formData;
    if (!tokenName || !tokenSymbol || !description || !decimals) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const publishNewBytecode = async (updatedBytes: Uint8Array) => {
    if (!account) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to create a token",
        variant: "destructive",
      });
      return;
    }

    const tx = new Transaction();
    tx.setGasBudget(100_000_000);

    const [upgradeCap] = tx.publish({
      modules: [[...updatedBytes]],
      dependencies: [normalizeSuiObjectId("0x1"), normalizeSuiObjectId("0x2")],
    });

    tx.transferObjects([upgradeCap], account.address);

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: async ({ digest }) => {
          const res = await suiClient.waitForTransaction({
            digest,
            options: {
              showEffects: true,
              showEvents: true,
              showObjectChanges: true,
              showBalanceChanges: true,
              showInput: true,
            },
          });

          if (res.effects?.status.status !== "success") {
            throw new Error("Publishing failed");
          }

          const createdArr = res.effects.created || [];
          const owner = createdArr.find((item) =>
            typeof item.owner === "object" && "AddressOwner" in item.owner
          )?.owner.AddressOwner || "";

          const newPkgId = res.objectChanges?.find((item) => item.type === "published")?.packageId || "";
          const treasuryCap = res.objectChanges?.find(
            (item) => item.type === "created" && typeof item.objectType === "string" && item.objectType.includes("TreasuryCap")
          )?.objectId || "";
          const denyCap = res.objectChanges?.find(
            (item) => item.type === "created" && typeof item.objectType === "string" && item.objectType.includes("DenyCap")
          )?.objectId;
          const metadata = res.objectChanges?.find(
            (item) => item.type === "created" && typeof item.objectType === "string" && item.objectType.includes("Metadata")
          )?.objectId;

          const tokenData: TokenData = {
            name: formData.tokenName,
            symbol: formData.tokenSymbol,
            description: formData.description || `${formData.tokenName} (${formData.tokenSymbol}) - Regulated Token`,
            decimal: formData.decimals,
            newPkgId,
            txId: res.digest,
            owner,
            treasuryCap,
            denyCap,
            metadata,
            type: "regulated",
            features,
          };

          setTokenData(tokenData);
          localStorage.setItem("tokenData", JSON.stringify(tokenData));

          toast({
            title: "Token created successfully!",
            description: "Your regulated token has been created and is ready to use.",
          });

          setTimeout(() => {
            router.push(`/generator/${network}/token`);
          }, 1000);
        },
        onError: (err) => {
          setIsCreatingToken(false);
          toast({
            title: "Transaction failed",
            description: "Failed to publish token contract",
            variant: "destructive",
          });
          console.error("Publish transaction failed:", err);
        },
      }
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsCreatingToken(true);

    try {
      const updateFn = features.pausable ? updatePRegCoin : updateURegCoin;
      const { updatedBytes } = await updateFn(
        formData.tokenName,
        formData.tokenSymbol,
        formData.description,
        Number(formData.decimals)
      );
      await publishNewBytecode(updatedBytes);
    } catch (err) {
      setIsCreatingToken(false);
      toast({
        title: "Token creation failed",
        description: "An error occurred while creating your token",
        variant: "destructive",
      });
      console.error("Token creation failed:", err);
    }
  };

  return (
    <motion.div
      className="mx-auto max-w-4xl overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center justify-between border-b border-zinc-800 p-6">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" onClick={onBack} className="mr-2 cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-bold text-white">Create Token on {getNetworkName()}</h2>
        </div>
        <div className="flex items-center">
          <div className="mr-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
            <span className="text-xl">😎</span>
          </div>
          <div>
            <div className="font-medium text-white">Regulated Token</div>
            <div className="text-sm text-teal-400">0.02 SUI</div>
          </div>
        </div>
      </div>

      <div className="p-6">
        <p className="mb-6 text-zinc-400">
          Launch your own regulated token on the {getNetworkName()} network with advanced features.
        </p>

        <div className="mb-6 rounded-lg bg-zinc-800 p-6">
          <h3 className="mb-4 font-medium text-white">Token Information</h3>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tokenName" className="flex items-center text-zinc-300">
                    Token Name*
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="ml-1 h-3.5 w-3.5 text-zinc-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="w-48 text-xs">The name of your token (e.g., &quot;My Awesome Token&quot;)</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <Input
                    id="tokenName"
                    value={formData.tokenName}
                    onChange={handleInputChange("tokenName")}
                    placeholder="My Awesome Token"
                    className="mt-1 border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 focus-visible:ring-teal-500"
                  />
                </div>
                <div>
                  <Label htmlFor="tokenSymbol" className="flex items-center text-zinc-300">
                    Token Symbol*
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="ml-1 h-3.5 w-3.5 text-zinc-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="w-48 text-xs">The symbol of your token (e.g., &quot;AWE&quot;). Usually 3-5 characters.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <Input
                    id="tokenSymbol"
                    value={formData.tokenSymbol}
                    onChange={handleInputChange("tokenSymbol")}
                    placeholder="AWE"
                    className="mt-1 border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 focus-visible:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center">
                  <Switch
                    id="customDecimals"
                    checked={customDecimals}
                    onCheckedChange={setCustomDecimals}
                    className="data-[state=checked]:bg-teal-500"
                  />
                  <Label htmlFor="customDecimals" className="ml-2 text-zinc-300">Custom Decimals</Label>
                </div>
                <p className="mb-2 text-xs text-zinc-500">Change the number of decimals for your token. Default: 9.</p>
                {customDecimals && (
                  <Input
                    id="decimals"
                    type="number"
                    value={formData.decimals}
                    onChange={handleInputChange("decimals")}
                    placeholder="9"
                    className="w-24 border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 focus-visible:ring-teal-500"
                    min="0"
                  />
                )}
              </div>

              <div>
                <Label htmlFor="description" className="flex items-center text-zinc-300">
                  Description*
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="ml-1 h-3.5 w-3.5 text-zinc-500" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="w-48 text-xs">A brief description of your token&apos;s purpose</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={handleInputChange("description")}
                  placeholder="A regulated token with advanced features"
                  className="mt-1 border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 focus-visible:ring-teal-500"
                />
                <p className="mt-1 text-xs text-zinc-500">A brief description of your token&apos;s purpose</p>
              </div>

              {/* <div>
                <Label htmlFor="initialSupply" className="flex items-center text-zinc-300">
                  Initial Supply*
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="ml-1 h-3.5 w-3.5 text-zinc-500" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="w-48 text-xs">The initial number of tokens created in your wallet</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <Input
                  id="initialSupply"
                  type="number"
                  value={formData.initialSupply}
                  onChange={handleInputChange("initialSupply")}
                  placeholder="1000000000"
                  className="mt-1 border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 focus-visible:ring-teal-500"
                  min="0"
                />
                <p className="mt-1 text-xs text-zinc-500">The initial number of tokens created in your wallet</p>
              </div>

              <div>
                <Label htmlFor="maxSupply" className="flex items-center text-zinc-300">
                  Max Supply*
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="ml-1 h-3.5 w-3.5 text-zinc-500" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="w-48 text-xs">The maximum number of tokens available</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <Input
                  id="maxSupply"
                  type="number"
                  value={formData.maxSupply}
                  onChange={handleInputChange("maxSupply")}
                  placeholder="1000000000"
                  className="mt-1 border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 focus-visible:ring-teal-500"
                  min="0"
                />
                <p className="mt-1 text-xs text-zinc-500">The maximum number of tokens available</p>
              </div> */}

              <div className="border-t border-zinc-700 pt-4">
                <h4 className="mb-3 font-medium text-white">Token Features</h4>
                <div className="space-y-4">
                  <div className="flex items-center">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <Flame className="mr-2 h-4 w-4 text-orange-400" />
                        <Label htmlFor="burnable" className="cursor-pointer text-zinc-300">Burnable</Label>
                      </div>
                      <p className="ml-6 mt-1 text-xs text-zinc-500">
                        Allows tokens to be burned to reduce circulating supply
                      </p>
                    </div>
                    <Switch
                      id="burnable"
                      checked={features.burnable}
                      onCheckedChange={handleFeatureChange("burnable")}
                      className="data-[state=checked]:bg-teal-500"
                    />
                  </div>

                  <div className="flex items-center">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <Coins className="mr-2 h-4 w-4 text-yellow-400" />
                        <Label htmlFor="mintable" className="cursor-pointer text-zinc-300">Mintable</Label>
                      </div>
                      <p className="ml-6 mt-1 text-xs text-zinc-500">
                        Allows creating new tokens after deployment
                      </p>
                    </div>
                    <Switch
                      id="mintable"
                      checked={features.mintable}
                      onCheckedChange={handleFeatureChange("mintable")}
                      className="data-[state=checked]:bg-teal-500"
                    />
                  </div>

                  <div className="flex items-center">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <Pause className="mr-2 h-4 w-4 text-blue-400" />
                        <Label htmlFor="pausable" className="cursor-pointer text-zinc-300">Pausable</Label>
                      </div>
                      <p className="ml-6 mt-1 text-xs text-zinc-500">
                        Allows pausing all token transfers in emergencies
                      </p>
                    </div>
                    <Switch
                      id="pausable"
                      checked={features.pausable}
                      onCheckedChange={handleFeatureChange("pausable")}
                      className="data-[state=checked]:bg-teal-500"
                    />
                  </div>

                  <div className="flex items-center">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <Shield className="mr-2 h-4 w-4 text-red-400" />
                        <Label htmlFor="denylist" className="cursor-pointer text-zinc-300">Denylist</Label>
                      </div>
                      <p className="ml-6 mt-1 text-xs text-zinc-500">
                        Allows blocking specific addresses from transferring tokens
                      </p>
                    </div>
                    <Switch
                      id="denylist"
                      checked={features.denylist}
                      onCheckedChange={handleFeatureChange("denylist")}
                      className="data-[state=checked]:bg-teal-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-4">
              <Button
                type="submit"
                className="w-full bg-purple-600 text-white cursor-pointer hover:bg-purple-700"
                disabled={isPending || isCreatingToken}
              >
                {isPending || isCreatingToken ? (
                  <div className="flex items-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Token...
                  </div>
                ) : (
                  "Create Token"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full border-zinc-700 cursor-pointer text-zinc-300 hover:bg-zinc-800 hover:text-white"
                disabled={isPending || isCreatingToken}
              >
                Create on Testnet for FREE
              </Button>
            </div>

            <div className="flex items-center justify-between pt-2 text-sm">
              <div className="text-zinc-400">
                Price: <span className="text-teal-400">0.02 SUI</span>
              </div>
              <Button variant="link" className="h-auto cursor-pointer p-0 text-purple-400">
                Activate Promocode
              </Button>
            </div>
          </form>
        </div>

        <div className="mt-8">
          <h3 className="mb-4 text-center font-medium text-white">Other Templates</h3>
          <div className="grid grid-cols-2 gap-4">
            <div
              className="cursor-pointer rounded-lg border border-zinc-700 bg-zinc-800 p-4 transition-colors hover:border-teal-500"
              onClick={() => onSwitchTemplate("standard")}
            >
              <div className="mb-2 flex items-center">
                <div className="mr-2 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-900/50">
                  <span className="text-lg">😊</span>
                </div>
                <div>
                  <div className="text-sm font-medium text-white">Standard Token</div>
                  <div className="text-xs text-teal-400">Price: 0.01 SUI</div>
                </div>
              </div>
              <div className="text-xs text-purple-400 hover:text-purple-300">Switch to this template</div>
            </div>
            <div
              className="cursor-pointer rounded-lg border border-zinc-700 bg-zinc-800 p-4 transition-colors hover:border-teal-500"
              onClick={() => onSwitchTemplate("closed-loop")}
            >
              <div className="mb-2 flex items-center">
                <div className="mr-2 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-900/50">
                  <span className="text-lg">🚀</span>
                </div>
                <div>
                  <div className="text-sm font-medium text-white">Closed-Loop Token</div>
                  <div className="text-xs text-teal-400">Price: 0.05 SUI</div>
                </div>
              </div>
              <div className="text-xs text-purple-400 hover:text-purple-300">Switch to this template</div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}