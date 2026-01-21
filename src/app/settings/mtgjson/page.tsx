"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type MtgjsonStatus = {
  dbPath: string;
  dbExists: boolean;
  dbSize: number | null;
  metaBuildDate: string | null;
  metaVersion: string | null;
  appBuildDate: string | null;
  appVersion: string | null;
  importStatus: string | null;
  lastImportAt: string | null;
  searchIndexUpdatedAt: string | null;
};

export default function MtgjsonSettingsPage() {
  const [status, setStatus] = useState<MtgjsonStatus | null>(null);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);

  async function loadStatus() {
    const response = await fetch("/api/mtgjson/status");
    if (!response.ok) return;
    const data = (await response.json()) as { status: MtgjsonStatus };
    setStatus(data.status);
  }

  useEffect(() => {
    loadStatus();
    const handle = setInterval(loadStatus, 5000);
    return () => clearInterval(handle);
  }, []);

  async function triggerImport() {
    await fetch("/api/mtgjson/import", { method: "POST" });
    await loadStatus();
  }

  async function triggerReindex() {
    await fetch("/api/mtgjson/reindex", { method: "POST" });
    await loadStatus();
  }

  async function verifyDb() {
    const response = await fetch("/api/mtgjson/verify", { method: "POST" });
    const data = await response.json();
    if (data.ok) {
      setVerifyMessage(
        `Verified. cards table rows: ${data.cardCount ?? 0}`,
      );
    } else {
      setVerifyMessage(`Verification failed: ${data.error ?? "Unknown error"}`);
    }
  }

  if (!status) {
    return <p className="text-sm text-muted-foreground">Loading status...</p>;
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-2 p-4">
        <h2 className="text-lg font-semibold">MTGJSON Status</h2>
        <div className="text-sm text-muted-foreground">
          Path: {status.dbPath}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant={status.dbExists ? "default" : "destructive"}>
            {status.dbExists ? "Database found" : "Database missing"}
          </Badge>
          {status.dbSize && (
            <Badge variant="secondary">
              {(status.dbSize / 1024 / 1024).toFixed(1)} MB
            </Badge>
          )}
          {status.importStatus && (
            <Badge variant="outline">{status.importStatus}</Badge>
          )}
        </div>
        <div className="grid gap-2 text-sm md:grid-cols-2">
          <div>
            Meta build date: {status.metaBuildDate ?? "n/a"}
          </div>
          <div>Meta version: {status.metaVersion ?? "n/a"}</div>
          <div>Imported build date: {status.appBuildDate ?? "n/a"}</div>
          <div>Imported version: {status.appVersion ?? "n/a"}</div>
          <div>Last import: {status.lastImportAt ?? "n/a"}</div>
          <div>Index updated: {status.searchIndexUpdatedAt ?? "n/a"}</div>
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button onClick={triggerImport}>
          Download + Decompress + Index MTGJSON
        </Button>
        <Button variant="outline" onClick={triggerReindex}>
          Rebuild Search Index
        </Button>
        <Button variant="secondary" onClick={verifyDb}>
          Verify DB
        </Button>
      </div>

      {verifyMessage && (
        <Card className="p-3 text-sm text-muted-foreground">
          {verifyMessage}
        </Card>
      )}
    </div>
  );
}
