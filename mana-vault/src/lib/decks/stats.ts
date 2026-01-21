import type { CardLookup } from "@/lib/search/lookup";

export type DeckCardEntry = {
  cardUuid: string;
  qty: number;
  category: string;
  isCommander: boolean;
};

export type DeckStats = {
  totalCards: number;
  totalNonLands: number;
  manaCurve: { manaValue: number; count: number }[];
  colorDistribution: { color: string; count: number }[];
  typeBreakdown: { type: string; count: number }[];
  categoryCounts: { category: string; count: number }[];
  avgManaValue: number | null;
  avgManaValueNonLands: number | null;
};

export type DeckValidationIssue = {
  type: string;
  message: string;
  cardUuid?: string;
};

export type DeckValidation = {
  status: "ok" | "warning" | "error";
  issues: DeckValidationIssue[];
  commanderColorIdentity: string;
};

const typeBuckets = [
  "Creature",
  "Instant",
  "Sorcery",
  "Artifact",
  "Enchantment",
  "Planeswalker",
  "Land",
  "Battle",
];

function normalizeColorIdentity(value: string | null | undefined) {
  return (value ?? "").toUpperCase();
}

function unionColorIdentities(values: string[]) {
  const letters = new Set<string>();
  values.forEach((entry) => {
    entry.split("").forEach((char) => letters.add(char));
  });
  return Array.from(letters).join("");
}

function isSubsetColor(cardIdentity: string, commanderIdentity: string) {
  if (!cardIdentity) return true;
  const commanderSet = new Set(commanderIdentity.split(""));
  return cardIdentity.split("").every((color) => commanderSet.has(color));
}

function bucketType(typeLine: string | null) {
  if (!typeLine) return "Other";
  for (const bucket of typeBuckets) {
    if (typeLine.includes(bucket)) return bucket;
  }
  return "Other";
}

export function computeDeckStats(
  deckCards: DeckCardEntry[],
  cardLookup: CardLookup[],
): { stats: DeckStats; validation: DeckValidation } {
  const lookupMap = new Map(
    cardLookup.map((card) => [card.cardUuid, card]),
  );

  const totalCards = deckCards.reduce((sum, card) => sum + card.qty, 0);
  const categoryCounts = new Map<string, number>();
  const manaCurve = new Map<number, number>();
  const colorDistribution = new Map<string, number>([
    ["W", 0],
    ["U", 0],
    ["B", 0],
    ["R", 0],
    ["G", 0],
    ["C", 0],
  ]);
  const typeBreakdown = new Map<string, number>();

  let totalManaValue = 0;
  let totalManaValueNonLands = 0;
  let totalNonLands = 0;

  deckCards.forEach((card) => {
    const details = lookupMap.get(card.cardUuid);
    const typeLine = details?.typeLine ?? null;
    const manaValue = details?.manaValue ?? 0;
    const bucket = bucketType(typeLine);

    categoryCounts.set(
      card.category,
      (categoryCounts.get(card.category) ?? 0) + card.qty,
    );

    manaCurve.set(
      Math.round(manaValue),
      (manaCurve.get(Math.round(manaValue)) ?? 0) + card.qty,
    );

    typeBreakdown.set(
      bucket,
      (typeBreakdown.get(bucket) ?? 0) + card.qty,
    );

    const identity = normalizeColorIdentity(details?.colorIdentity);
    if (!identity) {
      colorDistribution.set("C", (colorDistribution.get("C") ?? 0) + card.qty);
    } else {
      identity.split("").forEach((color) => {
        colorDistribution.set(
          color,
          (colorDistribution.get(color) ?? 0) + card.qty,
        );
      });
    }

    totalManaValue += manaValue * card.qty;

    if (bucket !== "Land") {
      totalManaValueNonLands += manaValue * card.qty;
      totalNonLands += card.qty;
    }
  });

  const stats: DeckStats = {
    totalCards,
    totalNonLands,
    manaCurve: Array.from(manaCurve.entries())
      .map(([manaValue, count]) => ({ manaValue, count }))
      .sort((a, b) => a.manaValue - b.manaValue),
    colorDistribution: Array.from(colorDistribution.entries()).map(
      ([color, count]) => ({ color, count }),
    ),
    typeBreakdown: Array.from(typeBreakdown.entries()).map(([type, count]) => ({
      type,
      count,
    })),
    categoryCounts: Array.from(categoryCounts.entries()).map(
      ([category, count]) => ({ category, count }),
    ),
    avgManaValue: totalCards ? totalManaValue / totalCards : null,
    avgManaValueNonLands: totalNonLands
      ? totalManaValueNonLands / totalNonLands
      : null,
  };

  const issues: DeckValidationIssue[] = [];
  const commanders = deckCards.filter((card) => card.isCommander);
  const commanderIdentities = commanders
    .map((card) => lookupMap.get(card.cardUuid))
    .map((details) => normalizeColorIdentity(details?.colorIdentity))
    .filter(Boolean);
  const commanderColorIdentity = unionColorIdentities(commanderIdentities);

  if (commanders.length === 0) {
    issues.push({
      type: "commander",
      message: "Deck must have a commander selected.",
    });
  } else if (commanders.length > 2) {
    issues.push({
      type: "commander",
      message: "Deck has more than two commanders.",
    });
  } else if (commanders.length === 2) {
    issues.push({
      type: "commander",
      message:
        "Two commanders selected. Ensure they are a legal partner pair.",
    });
  }

  commanders.forEach((commander) => {
    const details = lookupMap.get(commander.cardUuid);
    if (details && !details.isCommander) {
      issues.push({
        type: "commander-eligibility",
        message: `${details.name} is not commander-eligible.`,
        cardUuid: commander.cardUuid,
      });
    }
  });

  if (totalCards !== 100) {
    issues.push({
      type: "deck-size",
      message: `Deck has ${totalCards} cards (must be 100).`,
    });
  }

  deckCards.forEach((card) => {
    const details = lookupMap.get(card.cardUuid);
    if (!details) return;

    const legality = details.legalCommander;
    if (
      details.isBannedCommander ||
      (legality && legality !== "Legal" && legality !== "Unknown")
    ) {
      issues.push({
        type: "legality",
        message: `${details.name} is not legal in Commander.`,
        cardUuid: card.cardUuid,
      });
    }
  });

  if (commanderColorIdentity) {
    deckCards.forEach((card) => {
      if (card.isCommander) return;
      const details = lookupMap.get(card.cardUuid);
      if (!details) return;
      const identity = normalizeColorIdentity(details.colorIdentity);
      if (!isSubsetColor(identity, commanderColorIdentity)) {
        issues.push({
          type: "color-identity",
          message: `${details.name} exceeds commander color identity.`,
          cardUuid: card.cardUuid,
        });
      }
    });
  } else if (commanders.length) {
    issues.push({
      type: "color-identity",
      message: "Commander color identity could not be determined.",
    });
  }

  deckCards.forEach((card) => {
    if (card.qty <= 1) return;
    const details = lookupMap.get(card.cardUuid);
    if (!details) return;
    if (details.isBasic) return;
    issues.push({
      type: "singleton",
      message: `${details.name} has ${card.qty} copies (singleton required).`,
      cardUuid: card.cardUuid,
    });
  });

  const hasErrors = issues.some((issue) =>
    ["deck-size", "singleton", "legality", "color-identity"].includes(issue.type),
  );
  const hasWarnings = issues.some((issue) =>
    ["commander", "commander-eligibility"].includes(issue.type),
  );

  const status: DeckValidation["status"] = hasErrors
    ? "error"
    : hasWarnings
      ? "warning"
      : "ok";

  return {
    stats,
    validation: {
      status,
      issues,
      commanderColorIdentity,
    },
  };
}
