"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type DeckSummary = {
  id: string;
  name: string;
  commanderNames: string;
  colorIdentity: string;
  totalCards: number;
  updatedAt: string;
};

function ColorPips({ identity }: { identity: string }) {
  if (!identity) return <Badge variant="secondary">C</Badge>;
  return (
    <div className="flex flex-wrap gap-1">
      {identity.split("").map((color) => (
        <Badge key={color} variant="secondary">
          {color}
        </Badge>
      ))}
    </div>
  );
}

export default function DecksPage() {
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadDecks() {
    const response = await fetch("/api/decks");
    if (!response.ok) return;
    const data = (await response.json()) as { decks: DeckSummary[] };
    setDecks(data.decks ?? []);
  }

  useEffect(() => {
    loadDecks();
  }, []);

  async function createDeck() {
    if (!name.trim()) return;
    setLoading(true);
    const response = await fetch("/api/decks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (response.ok) {
      setName("");
      await loadDecks();
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="New deck name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="max-w-sm"
        />
        <Button onClick={createDeck} disabled={loading}>
          Create deck
        </Button>
      </div>

      <div className="grid gap-4">
        {decks.map((deck) => (
          <Card key={deck.id} className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <Link
                  href={`/decks/${deck.id}`}
                  className="text-lg font-semibold hover:underline"
                >
                  {deck.name}
                </Link>
                <div className="text-sm text-muted-foreground">
                  Commander: {deck.commanderNames || "Not set"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Updated {new Date(deck.updatedAt).toLocaleDateString()}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ColorPips identity={deck.colorIdentity} />
                <Badge variant="outline">{deck.totalCards} cards</Badge>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
