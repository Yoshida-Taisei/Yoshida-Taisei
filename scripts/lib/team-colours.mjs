/**
 * Club colour lookup, keyed by the three-letter code (TLA) that
 * football-data.org returns in `standings[].table[].team.tla`.
 *
 * The standings endpoint does NOT expose club colours, so they are kept here
 * by hand. Unknown or non-listed clubs simply fall back to FALLBACK_COLOUR, so
 * promotion/relegation between seasons never breaks the rendering.
 *
 * To add a club, add one line: "TLA": "#RRGGBB"
 */
export const FALLBACK_COLOUR = "#8b949e";

export const TEAM_COLOURS = {
  // Premier League regulars
  ARS: "#EF0107",
  AVL: "#95BFE5",
  BOU: "#DA291C",
  BRE: "#E30613",
  BHA: "#0057B8",
  CHE: "#034694",
  CRY: "#1B458F",
  EVE: "#003399",
  FUL: "#CC0000",
  LIV: "#C8102E",
  MCI: "#6CABDD",
  MUN: "#DA291C",
  NEW: "#41B6E6",
  NFO: "#DD0000",
  TOT: "#132257",
  WHU: "#7A263A",
  WOL: "#FDB913",
  // Recently promoted / relegated
  BUR: "#6C1D45",
  IPS: "#3A64A3",
  LEE: "#FFCD00",
  LEI: "#003090",
  LUT: "#F78F1E",
  SHU: "#EE2737",
  SOU: "#D71920",
  SUN: "#EB172B",
  WBA: "#122F67",
  NOR: "#FFF200",
  WAT: "#FBEE23",
  BRN: "#6C1D45",
};

export function colourForTla(tla) {
  if (!tla) return FALLBACK_COLOUR;
  return TEAM_COLOURS[tla.toUpperCase()] ?? FALLBACK_COLOUR;
}
