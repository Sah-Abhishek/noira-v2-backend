// services/getoutcodes.js
//
// Source of truth for the "service area" outcode dropdown is the
// `Location` collection (model: Location, field: postalcodes[]).
// The hardcoded list below is only used as a fallback when the DB
// collection is empty, so the dropdown still has sane defaults on a
// fresh install.

const Location = require("../models/Location");

const FALLBACK_LONDON_OUTCODES = [
  "CM", "CR", "DA",
  "E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8", "E9", "E10", "E11", "E12",
  "E13", "E14", "E15", "E16", "E17", "E18", "E20", "E22",
  "EC1A", "EC1M", "EC1N", "EC1P", "EC1R", "EC1V", "EC1Y",
  "EC2A", "EC2M", "EC2N", "EC2P", "EC2R", "EC2V", "EC2Y",
  "EC3A", "EC3M", "EC3N", "EC3P", "EC3R", "EC3V",
  "EC4A", "EC4M", "EC4N", "EC4P", "EC4R", "EC4V", "EC4Y",
  "HA", "IG",
  "N1", "N2", "N3", "N4", "N5", "N6", "N7", "N8", "N9", "N10", "N11", "N12",
  "N13", "N14", "N15", "N16", "N17", "N18", "N19", "N20", "N21", "N22", "N81",
  "NW1", "NW2", "NW3", "NW4", "NW5", "NW6", "NW7", "NW8", "NW9", "NW10", "NW11",
  "RM",
  "SE1", "SE2", "SE3", "SE4", "SE5", "SE6", "SE7", "SE8", "SE9",
  "SE10", "SE11", "SE12", "SE13", "SE14", "SE15", "SE16", "SE17", "SE18",
  "SE19", "SE20", "SE21", "SE22", "SE23", "SE24", "SE25", "SE26", "SE27", "SE28",
  "SM",
  "SW1A", "SW1E", "SW1H", "SW1P", "SW1V", "SW1W", "SW1X", "SW1Y",
  "SW2", "SW3", "SW4", "SW5", "SW6", "SW7", "SW8", "SW9", "SW10",
  "SW11", "SW12", "SW13", "SW14", "SW15", "SW16", "SW17", "SW18", "SW19", "SW20",
  "TN", "TW", "UB",
  "W1A", "W1B", "W1C", "W1D", "W1F", "W1G", "W1H", "W1J", "W1K", "W1S",
  "W1T", "W1U", "W1W",
  "W2", "W3", "W4", "W5", "W6", "W7", "W8", "W9", "W10", "W11", "W12", "W13", "W14",
  "WC1A", "WC1B", "WC1E", "WC1H", "WC1N", "WC1R", "WC1V", "WC1X",
  "WC2A", "WC2B", "WC2E", "WC2H", "WC2N", "WC2R",
  "WD",
  "KT", "SL",
];

// Natural sort so SE2 < SE10 (instead of "SE10" < "SE2" alphabetically).
const naturalCompare = (a, b) => {
  const re = /(\d+)|(\D+)/g;
  const aParts = a.match(re) || [];
  const bParts = b.match(re) || [];
  const len = Math.min(aParts.length, bParts.length);
  for (let i = 0; i < len; i++) {
    const ap = aParts[i];
    const bp = bParts[i];
    const aNum = /^\d+$/.test(ap);
    const bNum = /^\d+$/.test(bp);
    if (aNum && bNum) {
      const diff = parseInt(ap, 10) - parseInt(bp, 10);
      if (diff !== 0) return diff;
    } else {
      const cmp = ap.localeCompare(bp);
      if (cmp !== 0) return cmp;
    }
  }
  return aParts.length - bParts.length;
};

// In-memory cache so we don't hit Mongo on every keystroke.
let cache = { values: null, fetchedAt: 0 };
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function loadOutcodes() {
  const now = Date.now();
  if (cache.values && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.values;
  }
  try {
    const docs = await Location.find({}, { postalcodes: 1 }).lean();
    const set = new Set();
    for (const d of docs) {
      for (const code of d.postalcodes || []) {
        const v = String(code || "").trim().toUpperCase();
        if (v) set.add(v);
      }
    }
    let values;
    if (set.size === 0) {
      values = [...FALLBACK_LONDON_OUTCODES].sort(naturalCompare);
    } else {
      values = [...set].sort(naturalCompare);
    }
    cache = { values, fetchedAt: now };
    return values;
  } catch (err) {
    console.error("[getoutcodes] Location fetch failed, using fallback:", err.message);
    return [...FALLBACK_LONDON_OUTCODES].sort(naturalCompare);
  }
}

const getLondonOutcodes = async (req, res) => {
  try {
    let { q = "", limit = 50 } = req.query;
    limit = parseInt(limit, 10);
    if (!Number.isFinite(limit) || limit <= 0) limit = 50;

    const all = await loadOutcodes();
    const needle = String(q || "").trim().toUpperCase();
    const filtered = needle
      ? all.filter((code) => code.includes(needle))
      : all;

    const result = filtered.slice(0, limit).map((code) => ({ postcode: code }));
    res.status(200).json({ result });
  } catch (error) {
    console.error("Error fetching outcodes:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = getLondonOutcodes;
