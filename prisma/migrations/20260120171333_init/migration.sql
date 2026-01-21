-- CreateTable
CREATE TABLE "Deck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "allowMissing" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DeckCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deckId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeckCategory_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeckCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deckId" TEXT NOT NULL,
    "cardUuid" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "category" TEXT NOT NULL,
    "isCommander" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeckCard_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CollectionCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardUuid" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 0,
    "foilQty" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CategoryPreset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mtgjsonBuildDate" TEXT,
    "mtgjsonVersion" TEXT,
    "importStatus" TEXT,
    "lastImportAt" DATETIME,
    "searchIndexUpdatedAt" DATETIME,
    "mtgjsonFileSize" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "DeckCategory_deckId_name_key" ON "DeckCategory"("deckId", "name");

-- CreateIndex
CREATE INDEX "DeckCard_deckId_category_idx" ON "DeckCard"("deckId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "DeckCard_deckId_cardUuid_key" ON "DeckCard"("deckId", "cardUuid");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionCard_cardUuid_key" ON "CollectionCard"("cardUuid");
