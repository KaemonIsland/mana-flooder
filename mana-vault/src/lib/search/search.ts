import { getSearchDb } from "@/lib/search/db";
import type { SearchFilters } from "@/lib/search/parser";

export type SearchResult = {
  cardUuid: string;
  name: string;
  setCode: string;
  setName: string | null;
  manaCost: string | null;
  manaValue: number | null;
  typeLine: string | null;
  rarity: string | null;
  colors: string;
  colorIdentity: string;
  isLegendary: boolean;
  isBasic: boolean;
  isCommander: boolean;
  legalCommander: string | null;
  isBannedCommander: boolean;
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
    appendTerms("type_line", filters.typeTerms);
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
    clauses.push(`${field} = ''`);
  }

  if (colors.length || wantsMulticolor) {
    const requiredClauses: string[] = [];
    colors.forEach((color, index) => {
      const key = `${field.replace(".", "_")}_color_${index}`;
      params[key] = color;
      requiredClauses.push(`instr(${field}, @${key}) > 0`);
    });
    if (wantsMulticolor) {
      requiredClauses.push(`length(${field}) > 1`);
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
    joinFts = "JOIN search_cards_fts fts ON fts.rowid = s.id";
    clauses.push("fts MATCH @ftsQuery");
    params.ftsQuery = ftsQuery;
  }

  const colorClause = buildColorClause("s.colors", filters.colors, params);
  if (colorClause) clauses.push(colorClause);

  const identityClause = buildColorClause(
    "s.color_identity",
    filters.colorIdentity,
    params,
  );
  if (identityClause) clauses.push(identityClause);

  if (filters.manaValue) {
    if (typeof filters.manaValue.eq === "number") {
      clauses.push("s.mana_value = @manaValueEq");
      params.manaValueEq = filters.manaValue.eq;
    }
    if (typeof filters.manaValue.min === "number") {
      clauses.push("s.mana_value >= @manaValueMin");
      params.manaValueMin = filters.manaValue.min;
    }
    if (typeof filters.manaValue.max === "number") {
      clauses.push("s.mana_value <= @manaValueMax");
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
    clauses.push(`s.set_code IN (${setParams.join(", ")})`);
  }

  if (filters.isLegendary) clauses.push("s.is_legendary = 1");
  if (filters.isBasic) clauses.push("s.is_basic = 1");
  if (filters.isCommander) clauses.push("s.is_commander = 1");
  if (filters.legalCommander) clauses.push("s.legal_commander = 'Legal'");

  const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  params.limit = limit;
  params.offset = offset;

  const query = `
    SELECT
      s.card_uuid as cardUuid,
      s.name,
      s.set_code as setCode,
      s.set_name as setName,
      s.mana_cost as manaCost,
      s.mana_value as manaValue,
      s.type_line as typeLine,
      s.rarity,
      s.colors,
      s.color_identity as colorIdentity,
      s.is_legendary as isLegendary,
      s.is_basic as isBasic,
      s.is_commander as isCommander,
      s.legal_commander as legalCommander,
      s.is_banned_commander as isBannedCommander
    FROM search_cards s
    ${joinFts}
    ${whereClause}
    ORDER BY s.name ASC, s.set_code ASC
    LIMIT @limit OFFSET @offset
  `;

  return db.prepare(query).all(params) as SearchResult[];
}
