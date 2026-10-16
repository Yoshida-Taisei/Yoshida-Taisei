/**
 * Ids of Premier League clubs that currently have a Japanese player.
 *
 * Keyed by the football-data.org team id (the same key the crest cache uses).
 * The API does not expose player nationality, so this set is maintained by hand
 * and only needs a look after each transfer window. A club that is not listed
 * simply renders without the flag, so promotion/relegation never breaks the
 * render. The comments carry the squad so the ids stay reviewable.
 *
 * Last reviewed: 2026-10-16 (2026/27 season, 10 players at 9 clubs):
 *   58   Aston Villa          - Zion Suzuki
 *   64   Liverpool            - Wataru Endo
 *   73   Tottenham Hotspur    - Kota Takai (on loan at Sint-Truiden)
 *   322  Hull City            - Hidemasa Morita
 *   341  Leeds United         - Ao Tanaka
 *   349  Ipswich Town         - Daizen Maeda
 *   354  Crystal Palace       - Daichi Kamada, Takehiro Tomiyasu
 *   397  Brighton & Hove Albion - Kaoru Mitoma
 *   1076 Coventry City        - Tatsuhiro Sakamoto
 */
const JAPANESE_CLUB_IDS = new Set([58, 64, 73, 322, 341, 349, 354, 397, 1076]);

/**
 * @param {{ id?: number } | undefined} team
 * @returns {boolean} true when the club has a Japanese player in the squad.
 */
export function hasJapanesePlayer(team) {
  const id = Number(team?.id);
  return Number.isInteger(id) && JAPANESE_CLUB_IDS.has(id);
}
