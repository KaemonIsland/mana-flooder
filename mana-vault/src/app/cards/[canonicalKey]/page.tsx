import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  getAllPrintingsForCanonicalKey,
  getRepresentativePrintingForCanonicalKey,
} from "@/lib/mtgjson/canonical";
import { getCardByUuid, getPrintingsByUuids } from "@/lib/mtgjson/queries/cards";
import {
  getCommanderLegality,
  getLegalitiesByUuid,
} from "@/lib/mtgjson/queries/legalities";
import { getRulingsByUuid } from "@/lib/mtgjson/queries/rulings";
import { getPurchaseUrlsByUuid } from "@/lib/mtgjson/queries/purchaseUrls";
import { getIdentifiersByUuid } from "@/lib/mtgjson/queries/identifiers";
import { getTokensForCard } from "@/lib/mtgjson/queries/tokens";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import CollectionActions from "./collection-actions";

type PageProps = {
  params: { canonicalKey: string };
};

function formatLegalityBadge(status: string | null) {
  if (!status || status === "Unknown") {
    return <Badge variant="secondary">Unknown</Badge>;
  }
  const normalized = status.toLowerCase();
  if (normalized === "legal") {
    return <Badge variant="outline">Legal</Badge>;
  }
  if (normalized === "banned") {
    return <Badge variant="destructive">Banned</Badge>;
  }
  return <Badge variant="secondary">{status}</Badge>;
}

export default async function CardPage({ params }: PageProps) {
  const canonicalKey = decodeURIComponent(params.canonicalKey);
  const representative = getRepresentativePrintingForCanonicalKey(canonicalKey);
  if (!representative) return notFound();

  const card = getCardByUuid(representative.representativeUuid);
  if (!card) return notFound();

  const printingRefs = getAllPrintingsForCanonicalKey(canonicalKey);
  const printingUuids = Array.from(
    new Set(
      (printingRefs.length
        ? printingRefs.map((ref) => ref.uuid)
        : [representative.representativeUuid]
      ).filter(Boolean),
    ),
  );
  const printings = getPrintingsByUuids(printingUuids).sort((a, b) => {
    const left = b.releaseDate ?? "";
    const right = a.releaseDate ?? "";
    if (left !== right) return left.localeCompare(right);
    return (a.setCode ?? "").localeCompare(b.setCode ?? "");
  });

  const commanderLegality = getCommanderLegality(card.uuid);
  const legalities = getLegalitiesByUuid(card.uuid);
  const rulings = getRulingsByUuid(card.uuid);
  const purchaseUrls = getPurchaseUrlsByUuid(card.uuid);
  const identifiers = getIdentifiersByUuid(card.uuid);
  const tokens = getTokensForCard(card.uuid);

  const [collectionCards, deckCards] = await Promise.all([
    printingUuids.length
      ? prisma.collectionCard.findMany({
          where: { cardUuid: { in: printingUuids } },
        })
      : Promise.resolve([]),
    printingUuids.length
      ? prisma.deckCard.findMany({
          where: { cardUuid: { in: printingUuids } },
          include: { deck: true },
        })
      : Promise.resolve([]),
  ]);

  const collectionTotals = collectionCards.reduce(
    (totals, entry) => ({
      qty: totals.qty + entry.qty,
      foilQty: totals.foilQty + entry.foilQty,
    }),
    { qty: 0, foilQty: 0 },
  );

  const collectionMap = new Map(
    collectionCards.map((entry) => [entry.cardUuid, entry]),
  );

  const collectionPrintings = printings
    .map((printing) => ({
      ...printing,
      qty: collectionMap.get(printing.uuid)?.qty ?? 0,
      foilQty: collectionMap.get(printing.uuid)?.foilQty ?? 0,
    }))
    .filter((entry) => entry.qty > 0 || entry.foilQty > 0);

  const deckMap = new Map<
    string,
    { id: string; name: string; totalQty: number; categories: Map<string, number> }
  >();
  deckCards.forEach((entry) => {
    const deckId = entry.deckId;
    if (!deckMap.has(deckId)) {
      deckMap.set(deckId, {
        id: deckId,
        name: entry.deck.name,
        totalQty: 0,
        categories: new Map<string, number>(),
      });
    }
    const deck = deckMap.get(deckId);
    if (!deck) return;
    deck.totalQty += entry.qty;
    deck.categories.set(
      entry.category,
      (deck.categories.get(entry.category) ?? 0) + entry.qty,
    );
  });

  const decks = Array.from(deckMap.values()).map((deck) => ({
    ...deck,
    categories: Array.from(deck.categories.entries()).map(([name, count]) => ({
      name,
      count,
    })),
  }));
  decks.sort((a, b) => a.name.localeCompare(b.name));

  const isLegendary = card.supertypes.includes("Legendary");
  const isCommanderEligible =
    card.leadershipSkills?.commander === true ||
    (isLegendary && card.typeLine?.toLowerCase().includes("creature"));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1 space-y-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold">{card.name}</h1>
              {card.manaCost && (
                <span className="text-sm text-muted-foreground">
                  {card.manaCost}
                </span>
              )}
              {isCommanderEligible ? (
                <Badge variant="outline">Commander eligible</Badge>
              ) : (
                <Badge variant="secondary">Not commander eligible</Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground">{card.typeLine}</div>
            <div className="whitespace-pre-line text-sm">
              {card.text ?? "No oracle text available."}
            </div>
          </div>

          <Tabs defaultValue="printings">
            <TabsList>
              <TabsTrigger value="printings">Printings</TabsTrigger>
              <TabsTrigger value="rulings">Rulings</TabsTrigger>
              <TabsTrigger value="legality">Legality</TabsTrigger>
              <TabsTrigger value="purchase">Purchase</TabsTrigger>
              <TabsTrigger value="identifiers">Identifiers</TabsTrigger>
            </TabsList>

            <TabsContent value="printings" className="space-y-4">
              <Card className="p-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Set</TableHead>
                      <TableHead>Release</TableHead>
                      <TableHead>Number</TableHead>
                      <TableHead>Rarity</TableHead>
                      <TableHead>Finishes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {printings.map((printing) => (
                      <TableRow key={printing.uuid}>
                        <TableCell>
                          {printing.setCode ?? "n/a"}{" "}
                          {printing.setName ? `- ${printing.setName}` : ""}
                        </TableCell>
                        <TableCell>{printing.releaseDate ?? "n/a"}</TableCell>
                        <TableCell>{printing.number ?? "n/a"}</TableCell>
                        <TableCell>{printing.rarity ?? "n/a"}</TableCell>
                        <TableCell>
                          {printing.finishes.length
                            ? printing.finishes.join(", ")
                            : "n/a"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>

              {tokens.length > 0 && (
                <Card className="space-y-2 p-4">
                  <div className="text-sm font-semibold text-muted-foreground">
                    Related tokens
                  </div>
                  <div className="space-y-2">
                    {tokens.map((token) => (
                      <div key={token.uuid} className="text-sm">
                        <div className="font-medium">{token.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {token.typeLine ?? "Token"}{" "}
                          {token.setCode ? `- ${token.setCode}` : ""}
                        </div>
                        {token.text && (
                          <div className="whitespace-pre-line text-xs">
                            {token.text}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="rulings" className="space-y-3">
              {rulings.length ? (
                rulings.map((ruling, index) => (
                  <Card key={`${ruling.date ?? "ruling"}-${index}`} className="p-4">
                    <div className="text-xs text-muted-foreground">
                      {ruling.date ?? "Unknown date"}{" "}
                      {ruling.source ? `- ${ruling.source}` : ""}
                    </div>
                    <div className="text-sm">{ruling.text}</div>
                  </Card>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No rulings available.
                </p>
              )}
            </TabsContent>

            <TabsContent value="legality" className="space-y-4">
              <Card className="space-y-3 p-4">
                <div className="text-sm font-semibold text-muted-foreground">
                  Commander
                </div>
                <div>{formatLegalityBadge(commanderLegality)}</div>
              </Card>
              <Card className="space-y-2 p-4">
                <div className="text-sm font-semibold text-muted-foreground">
                  All formats
                </div>
                {legalities.length ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {legalities.map((legality) => (
                      <div
                        key={`${legality.format}-${legality.status}`}
                        className="flex items-center justify-between text-sm"
                      >
                        <span>{legality.format}</span>
                        <span>{legality.status}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No legality data available.
                  </p>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="purchase" className="space-y-3">
              {purchaseUrls.length ? (
                purchaseUrls.map((purchase) => (
                  <Card key={`${purchase.provider}-${purchase.url}`} className="p-4">
                    <div className="text-sm font-semibold">
                      {purchase.provider}
                    </div>
                    <Link
                      href={purchase.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-muted-foreground underline"
                    >
                      {purchase.url}
                    </Link>
                  </Card>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No purchase links available.
                </p>
              )}
            </TabsContent>

            <TabsContent value="identifiers" className="space-y-3">
              {identifiers && Object.keys(identifiers).length ? (
                <Card className="p-4">
                  <div className="grid gap-2 text-sm">
                    {Object.entries(identifiers)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([key, value]) => (
                        <div key={key} className="flex justify-between gap-4">
                          <span className="text-muted-foreground">{key}</span>
                          <span className="truncate">{value}</span>
                        </div>
                      ))}
                  </div>
                </Card>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No identifiers available.
                </p>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <aside className="w-full space-y-4 lg:w-80">
          <Card className="space-y-2 p-4">
            <div className="text-sm font-semibold text-muted-foreground">
              In decks
            </div>
            {decks.length ? (
              <div className="space-y-2 text-sm">
                {decks.map((deck) => (
                  <div key={deck.id} className="space-y-1">
                    <Link
                      href={`/decks/${deck.id}`}
                      className="font-medium hover:underline"
                    >
                      {deck.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {deck.totalQty} copies
                    </div>
                    {deck.categories.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {deck.categories
                          .map((category) => `${category.name}: ${category.count}`)
                          .join(", ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Not used in any decks.
              </p>
            )}
          </Card>

          <Card className="space-y-2 p-4">
            <div className="text-sm font-semibold text-muted-foreground">
              In collection
            </div>
            <div className="text-sm">
              Total: {collectionTotals.qty + collectionTotals.foilQty} (foil{" "}
              {collectionTotals.foilQty})
            </div>
            {collectionPrintings.length ? (
              <div className="space-y-1 text-xs text-muted-foreground">
                {collectionPrintings.map((printing) => (
                  <div
                    key={printing.uuid}
                    className="flex items-center justify-between"
                  >
                    <span>
                      {printing.setCode ?? "n/a"}{" "}
                      {printing.number ? `#${printing.number}` : ""}
                    </span>
                    <span>
                      {printing.qty}/{printing.foilQty}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No copies in collection.
              </p>
            )}
          </Card>

          <Card className="space-y-3 p-4">
            <div className="text-sm font-semibold text-muted-foreground">
              Add to collection
            </div>
            <CollectionActions
              printings={printings.map((printing) => ({
                uuid: printing.uuid,
                setCode: printing.setCode,
                setName: printing.setName,
                releaseDate: printing.releaseDate,
                number: printing.number,
                finishes: printing.finishes,
              }))}
              defaultUuid={representative.representativeUuid}
            />
          </Card>
        </aside>
      </div>
    </div>
  );
}
