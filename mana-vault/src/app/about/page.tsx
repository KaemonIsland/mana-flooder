import { Card } from "@/components/ui/card";

export default function AboutPage() {
  return (
    <div className="space-y-4">
      <Card className="space-y-2 p-4">
        <h2 className="text-lg font-semibold">About ManaVault</h2>
        <p className="text-sm text-muted-foreground">
          ManaVault is a local-first MTG collection tracker and Commander deck
          builder. Card data comes from MTGJSON (AllPrintings SQLite), while your
          decks and collection are stored in a local SQLite database via Prisma.
        </p>
      </Card>
      <Card className="space-y-2 p-4">
        <h3 className="text-sm font-semibold">Quick tips</h3>
        <ul className="list-inside list-disc text-sm text-muted-foreground">
          <li>
            Import MTGJSON data from the Settings page before searching cards.
          </li>
          <li>
            Use Scryfall-style queries such as{" "}
            <code className="rounded bg-muted px-1 py-0.5">t:creature</code> or{" "}
            <code className="rounded bg-muted px-1 py-0.5">mv&lt;=3</code>.
          </li>
          <li>
            Deck validation runs automatically as you add cards and commanders.
          </li>
        </ul>
      </Card>
    </div>
  );
}
