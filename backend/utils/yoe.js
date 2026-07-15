const MONTH_MAP = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function normalizeSeparators(text = "") {
  return String(text)
    .trim()
    .replace(/[–—]/g, "-")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ");
}

function monthToNumber(token = "") {
  return MONTH_MAP[token.slice(0, 3).toLowerCase()] || null;
}

function clampNonNegative(value) {
  return Number.isFinite(value) ? Math.max(0, value) : null;
}

export function formatYoeRange(min, max) {
  if (!Number.isFinite(min) && !Number.isFinite(max)) return "Unknown";
  if (Number.isFinite(min) && !Number.isFinite(max)) return `${min}+`;
  if (min === max) return String(min);
  return `${min}-${max}`;
}

export function parseYoeRange(rawValue) {
  const raw = normalizeSeparators(rawValue);

  if (!raw) {
    return {
      raw,
      valid: false,
      min: null,
      max: null,
      mid: null,
      label: "Unknown",
      reason: "missing_yoe",
    };
  }

  const simpleRange = raw.match(/^(\d{1,2})\s*-\s*(\d{1,2})(?:\s*(?:years?|yrs?))?$/i);
  if (simpleRange) {
    const min = clampNonNegative(Number.parseInt(simpleRange[1], 10));
    const max = clampNonNegative(Number.parseInt(simpleRange[2], 10));
    return {
      raw,
      valid: true,
      min,
      max,
      mid: Math.round((min + max) / 2),
      label: formatYoeRange(min, max),
      reason: "normalized_range",
    };
  }

  const plusRange = raw.match(/^(\d{1,2})\s*\+(?:\s*(?:years?|yrs?))?$/i);
  if (plusRange) {
    const min = clampNonNegative(Number.parseInt(plusRange[1], 10));
    return {
      raw,
      valid: true,
      min,
      max: null,
      mid: min,
      label: formatYoeRange(min, null),
      reason: "normalized_plus",
    };
  }

  const singleYear = raw.match(/^(\d{1,2})(?:\s*(?:years?|yrs?))?$/i);
  if (singleYear) {
    const year = clampNonNegative(Number.parseInt(singleYear[1], 10));
    return {
      raw,
      valid: true,
      min: year,
      max: year,
      mid: year,
      label: formatYoeRange(year, year),
      reason: "normalized_single",
    };
  }

  const monthRangeLeft = raw.match(/^(\d{1,2})-([A-Za-z]{3,})$/);
  if (monthRangeLeft) {
    const min = clampNonNegative(Number.parseInt(monthRangeLeft[1], 10));
    const max = monthToNumber(monthRangeLeft[2]);
    if (Number.isFinite(min) && Number.isFinite(max)) {
      return {
        raw,
        valid: true,
        min,
        max,
        mid: Math.round((min + max) / 2),
        label: formatYoeRange(min, max),
        reason: "normalized_month_excel",
      };
    }
  }

  const monthRangeRight = raw.match(/^([A-Za-z]{3,})-(\d{1,2})$/);
  if (monthRangeRight) {
    const min = monthToNumber(monthRangeRight[1]);
    const max = clampNonNegative(Number.parseInt(monthRangeRight[2], 10));
    if (Number.isFinite(min) && Number.isFinite(max)) {
      return {
        raw,
        valid: true,
        min,
        max,
        mid: Math.round((min + max) / 2),
        label: formatYoeRange(min, max),
        reason: "normalized_month_excel",
      };
    }
  }

  return {
    raw,
    valid: false,
    min: null,
    max: null,
    mid: null,
    label: "Unknown",
    reason: "invalid_yoe",
  };
}
