import { notFound } from "next/navigation";

import { SetSymbol } from "@/components/cards/set-symbol";
import { SearchResultsView } from "@/components/search/search-results-view";
import { Panel } from "@/components/ui/panel";
import { getSetByCode } from "@/lib/mtgjson/queries/sets";

type PageProps = {
  params: { setCode: string };
};

export default function SetDetailPage({ params }: PageProps) {
  const setCode = decodeURIComponent(params.setCode).toUpperCase();
  const set = getSetByCode(setCode);

  if (!set) {
    return notFound();
  }

  return (
    <div className="space-y-6">
      <Panel className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <SetSymbol setCode={set.code} rarity="rare" className="text-[0.6rem]" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {set.name}
            </h1>
            <div className="text-sm text-white/60">
              {set.code}
              {set.type ? ` • ${set.type}` : ""}
            </div>
          </div>
        </div>
        <div className="text-xs text-white/50">
          Release date: {set.releaseDate ?? "Unknown"}
        </div>
      </Panel>

      <SearchResultsView
        title="Cards"
        description="Search within this set."
        setScope={set.code}
        defaultSortKey="setNumber"
      />
    </div>
  );
}
