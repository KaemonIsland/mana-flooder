export type ManaValueFilter = {
  min?: number;
  max?: number;
  eq?: number;
};

export type StatRangeFilter = {
  min?: number;
  max?: number;
};

export type SearchFilters = {
  nameTerms: string[];
  oracleTerms: string[];
  typeTerms: string[];
  textTerms: string[];
  colors?: string[];
  colorIdentity?: string[];
  manaValue?: ManaValueFilter;
  manaCost?: string;
  rarities?: string[];
  setCodes?: string[];
  cardTypes?: string[];
  power?: StatRangeFilter;
  toughness?: StatRangeFilter;
  artist?: string;
  flavor?: string;
};

const tokenRegex = /"[^"]+"|\S+/g;
const colorMap = new Set(["W", "U", "B", "R", "G", "C"]);

function normalizeValue(raw: string) {
  const trimmed = raw.trim();
  if (trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function addUnique(list: string[], value: string) {
  if (!value) return;
  if (!list.includes(value)) {
    list.push(value);
  }
}

function parseColorString(raw: string): string[] {
  const upper = raw.toUpperCase();
  const matches = [...upper].filter((char) => colorMap.has(char));
  return Array.from(new Set(matches));
}

function parseManaValueToken(
  token: string,
  filters: SearchFilters,
): boolean {
  const match = token.match(/^mv(<=|>=|=|<|>)(\d+(\.\d+)?)$/i);
  if (!match) return false;

  const value = Number(match[2]);
  if (Number.isNaN(value)) return false;

  const manaValue = filters.manaValue ?? {};
  switch (match[1]) {
    case "=":
      manaValue.eq = value;
      break;
    case "<":
      manaValue.max = value - 0.0001;
      break;
    case "<=":
      manaValue.max = value;
      break;
    case ">":
      manaValue.min = value + 0.0001;
      break;
    case ">=":
      manaValue.min = value;
      break;
    default:
      break;
  }

  filters.manaValue = manaValue;
  return true;
}

export function parseSearchQuery(input: string): SearchFilters {
  const baseFilters: SearchFilters = {
    nameTerms: [],
    oracleTerms: [],
    typeTerms: [],
    textTerms: [],
  };

  if (!input.trim()) {
    return baseFilters;
  }

  try {
    const tokens = input.match(tokenRegex) ?? [];

    for (const rawToken of tokens) {
      const token = rawToken.trim();
      if (!token) continue;

      if (parseManaValueToken(token, baseFilters)) {
        continue;
      }

      const colonIndex = token.indexOf(":");
      if (colonIndex === -1) {
        addUnique(baseFilters.textTerms, normalizeValue(token));
        continue;
      }

      const key = token.slice(0, colonIndex).toLowerCase();
      const rawValue = token.slice(colonIndex + 1);
      const value = normalizeValue(rawValue);

      switch (key) {
        case "name":
        case "n":
          addUnique(baseFilters.nameTerms, value);
          break;
        case "o":
          addUnique(baseFilters.oracleTerms, value);
          break;
        case "t":
          addUnique(baseFilters.typeTerms, value);
          break;
        case "c": {
          const colors = parseColorString(value);
          baseFilters.colors = colors.length ? colors : baseFilters.colors;
          break;
        }
        case "id": {
          const colors = parseColorString(value);
          baseFilters.colorIdentity = colors.length
            ? colors
            : baseFilters.colorIdentity;
          break;
        }
        case "mv":
          parseManaValueToken(`mv=${value}`, baseFilters);
          break;
        case "r":
          baseFilters.rarities = Array.from(
            new Set([...(baseFilters.rarities ?? []), value.toLowerCase()]),
          );
          break;
        case "set":
          baseFilters.setCodes = Array.from(
            new Set([...(baseFilters.setCodes ?? []), value.toUpperCase()]),
          );
          break;
        default:
          addUnique(baseFilters.textTerms, normalizeValue(token));
          break;
      }
    }

    return baseFilters;
  } catch {
    return {
      nameTerms: [],
      oracleTerms: [],
      typeTerms: [],
      textTerms: input.split(/\s+/).filter(Boolean),
    };
  }
}
