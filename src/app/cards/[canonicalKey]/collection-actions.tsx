"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PrintingOption = {
  uuid: string;
  setCode: string | null;
  setName: string | null;
  releaseDate: string | null;
  number: string | null;
  finishes: string[];
};

type Props = {
  printings: PrintingOption[];
  defaultUuid: string;
};

function resolveFinishOptions(finishes: string[]) {
  if (!finishes.length) {
    return ["nonfoil", "foil"];
  }
  const normalized = finishes.map((finish) => finish.toLowerCase());
  const hasNonfoil = normalized.includes("nonfoil");
  const hasFoil = normalized.some(
    (finish) => finish !== "nonfoil" && finish.includes("foil"),
  );
  const hasEtched = normalized.includes("etched");

  const options: string[] = [];
  if (hasNonfoil) options.push("nonfoil");
  if (hasFoil || hasEtched) options.push("foil");
  return options.length ? options : ["nonfoil"];
}

export default function CollectionActions({ printings, defaultUuid }: Props) {
  const router = useRouter();
  const [selectedUuid, setSelectedUuid] = useState(defaultUuid);
  const [finish, setFinish] = useState("nonfoil");
  const [qty, setQty] = useState("1");
  const [saving, setSaving] = useState(false);

  const selectedPrinting = useMemo(
    () => printings.find((printing) => printing.uuid === selectedUuid),
    [printings, selectedUuid],
  );

  useEffect(() => {
    if (!selectedPrinting && printings.length) {
      setSelectedUuid(printings[0].uuid);
    }
  }, [selectedPrinting, printings]);

  const finishOptions = useMemo(
    () => resolveFinishOptions(selectedPrinting?.finishes ?? []),
    [selectedPrinting],
  );

  useEffect(() => {
    if (!finishOptions.includes(finish)) {
      setFinish(finishOptions[0] ?? "nonfoil");
    }
  }, [finishOptions, finish]);

  async function addToCollection() {
    if (!selectedPrinting) return;
    const quantity = Math.max(1, Number(qty) || 1);
    const payload =
      finish === "foil"
        ? { cardUuid: selectedUuid, foilDelta: quantity }
        : { cardUuid: selectedUuid, delta: quantity };

    setSaving(true);
    await fetch("/api/collection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    router.refresh();
  }

  if (!printings.length) {
    return (
      <div className="text-sm text-muted-foreground">
        No printings available to add.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Printing</Label>
        <Select value={selectedUuid} onValueChange={setSelectedUuid}>
          <SelectTrigger>
            <SelectValue placeholder="Select printing" />
          </SelectTrigger>
          <SelectContent>
            {printings.map((printing) => (
              <SelectItem key={printing.uuid} value={printing.uuid}>
                {printing.setCode ?? "n/a"}{" "}
                {printing.number ? `#${printing.number}` : ""}{" "}
                {printing.setName ? `- ${printing.setName}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Finish</Label>
        <Select value={finish} onValueChange={setFinish}>
          <SelectTrigger>
            <SelectValue placeholder="Finish" />
          </SelectTrigger>
          <SelectContent>
            {finishOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {option === "foil" ? "Foil" : "Non-foil"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Quantity</Label>
        <Input
          value={qty}
          onChange={(event) => setQty(event.target.value)}
          type="number"
          min={1}
        />
      </div>
      <Button onClick={addToCollection} disabled={saving}>
        {saving ? "Adding..." : "Add to collection"}
      </Button>
    </div>
  );
}
