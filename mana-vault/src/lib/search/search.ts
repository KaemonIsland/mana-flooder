import { getSearchDb } from "@/lib/search/db";
import type { SearchFilters } from "@/lib/search/parser";

export type SearchResult = {
  canonicalKey: string;
  representativeUuid: string;
  name: string;
  asciiName: string | null;
  manaCost: string | null;
  manaValue: number | null;
  typeLine: string | null;
  rarity: string | null;
  colors: string[];
  colorIdentity: string[];
  latestSetCode: string | null;
  latestReleaseDate: string | null;
};

type SearchOptions = {
  limit?: number;
  offset?: number;
};

function escapeFtsTerm(term: string) {
  const sanitized = term.replace(/"/g, "\"\"");
  if (/\s/.test(sanitized)) {
    return `"${sanitized}"`;
  }
  return sanitized;
}

function buildFtsQuery(filters: SearchFilters) {
  const parts: string[] = [];
  const appendTerms = (prefix: string, terms: string[]) => {
    for (const term of terms) {
      parts.push(`${prefix}:${escapeFtsTerm(term)}`);
    }
  };

  if (filters.nameTerms.length) {
    appendTerms("name", filters.nameTerms);
  }
  if (filters.oracleTerms.length) {
    appendTerms("text", filters.oracleTerms);
  }
  if (filters.typeTerms.length) {
    appendTerms("type", filters.typeTerms);
  }
  if (filters.textTerms.length) {
    for (const term of filters.textTerms) {
      parts.push(escapeFtsTerm(term));
    }
  }

  return parts.length ? parts.join(" AND ") : null;
}

function buildColorClause(
  field: string,
  selected: string[] | undefined,
  params: Record<string, unknown>,
) {
  if (!selected || selected.length === 0) return null;

  const wantsColorless = selected.includes("C");
  const wantsMulticolor = selected.includes("M");
  const colors = selected.filter((entry) =>
    ["W", "U", "B", "R", "G"].includes(entry),
  );

  const clauses: string[] = [];

  if (wantsColorless) {
    clauses.push(`${field} IS NULL OR ${field} = '' OR ${field} = '[]'`);
  }

  if (colors.length || wantsMulticolor) {
    const requiredClauses: string[] = [];
    colors.forEach((color, index) => {
      const key = `${field.replace(".", "_")}_color_${index}`;
      params[key] = `"${color}"`;
      requiredClauses.push(`instr(${field}, @${key}) > 0`);
    });
    if (wantsMulticolor) {
      requiredClauses.push(`${field} LIKE '%","%'`);
    }
    clauses.push(requiredClauses.join(" AND "));
  }

  if (!clauses.length) return null;
  return `(${clauses.join(" OR ")})`;
}

export function searchCards(filters: SearchFilters, options: SearchOptions = {}) {
  const db = getSearchDb();
  const params: Record<string, unknown> = {};
  const clauses: string[] = [];

  const ftsQuery = buildFtsQuery(filters);
  let joinFts = "";
  if (ftsQuery) {
    joinFts = "JOIN card_search_fts fts ON fts.canonicalKey = s.canonicalKey";
    clauses.push("fts MATCH @ftsQuery");
    params.ftsQuery = ftsQuery;
  }

  const colorClause = buildColorClause("s.colors", filters.colors, params);
  if (colorClause) clauses.push(colorClause);

  const identityClause = buildColorClause(
    "s.colorIdentity",
    filters.colorIdentity,
    params,
  );
  if (identityClause) clauses.push(identityClause);

  if (filters.manaValue) {
    if (typeof filters.manaValue.eq === "number") {
      clauses.push("s.manaValue = @manaValueEq");
      params.manaValueEq = filters.manaValue.eq;
    }
    if (typeof filters.manaValue.min === "number") {
      clauses.push("s.manaValue >= @manaValueMin");
      params.manaValueMin = filters.manaValue.min;
    }
    if (typeof filters.manaValue.max === "number") {
      clauses.push("s.manaValue <= @manaValueMax");
      params.manaValueMax = filters.manaValue.max;
    }
  }

  if (filters.rarities?.length) {
    const rarityParams = filters.rarities.map((rarity, index) => {
      const key = `rarity_${index}`;
      params[key] = rarity;
      return `@${key}`;
    });
    clauses.push(`s.rarity IN (${rarityParams.join(", ")})`);
  }

  if (filters.setCodes?.length) {
    const setParams = filters.setCodes.map((code, index) => {
      const key = `set_${index}`;
      params[key] = code;
      return `@${key}`;
    });
    clauses.push(`s.latestSetCode IN (${setParams.join(", ")})`);
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  params.limit = limit;
  params.offset = offset;

  const query = `
    SELECT
      s.canonicalKey as canonicalKey,
      s.representativeUuid as representativeUuid,
      s.name,
      s.asciiName as asciiName,
      s.manaCost as manaCost,
      s.manaValue as manaValue,
      s.type as typeLine,
      s.rarity,
      s.colors,
      s.colorIdentity as colorIdentity,
      s.latestSetCode as latestSetCode,
      s.latestReleaseDate as latestReleaseDate
    FROM card_search s
    ${joinFts}
    ${whereClause}
    ORDER BY COALESCE(s.normalizedName, s.name) ASC, s.latestReleaseDate DESC
    LIMIT @limit OFFSET @offset
  `;

  const rows = db.prepare(query).all(params) as Array<{
    canonicalKey: string;
    representativeUuid: string;
    name: string;
    asciiName: string | null;
    manaCost: string | null;
    manaValue: number | null;
    typeLine: string | null;
    rarity: string | null;
    colors: string | null;
    colorIdentity: string | null;
    latestSetCode: string | null;
    latestReleaseDate: string | null;
  }>;

  const parseJsonArray = (value: string | null) => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((entry) => String(entry));
      }
      return [];
    } catch {
      return [];
    }
  };

  const toNumber = (value: unknown) => {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") return value;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

  return rows.map((row) => ({
    canonicalKey: row.canonicalKey,
    representativeUuid: row.representativeUuid,
    name: row.name,
    asciiName: row.asciiName ?? null,
    manaCost: row.manaCost ?? null,
    manaValue: toNumber(row.manaValue),
    typeLine: row.typeLine ?? null,
    rarity: row.rarity ?? null,
    colors: parseJsonArray(row.colors ?? null),
    colorIdentity: parseJsonArray(row.colorIdentity ?? null),
    latestSetCode: row.latestSetCode ?? null,
    latestReleaseDate: row.latestReleaseDate ?? null,
  }));
}
