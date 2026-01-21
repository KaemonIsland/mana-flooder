# ManaVault

ManaVault is a local-first MTG collection tracker and Commander deck builder.
Card data comes from MTGJSON’s AllPrintings SQLite export, and your collection
and decks live in a local SQLite database managed by Prisma.

## Requirements

- Node.js 20+
- pnpm 10+

## Setup

```bash
pnpm install
cp .env.example .env
```

### Initialize the app database

```bash
pnpm prisma:generate
pnpm prisma:migrate
```

The app database defaults to `/data/app/app.sqlite`. Create the parent folder
if it doesn’t exist:

```bash
mkdir -p /data/app
```

### Import MTGJSON

Download, decompress, and build the search index:

```bash
pnpm mtgjson:import
```

You can also run each step independently:

```bash
pnpm mtgjson:download
pnpm mtgjson:decompress
pnpm mtgjson:reindex
```

The MTGJSON SQLite file lives at `/data/mtgjson/AllPrintings.sqlite`.

### Run the app

```bash
pnpm dev
```

Visit http://localhost:3000 to use the app.

## Notes

- Search and filtering run against the local MTGJSON SQLite database (no external APIs).
- Deck validation enforces Commander rules: 100 cards, singleton, color identity,
  and banned cards.
- Use the Settings → MTGJSON Import page to monitor import status and reindex.
