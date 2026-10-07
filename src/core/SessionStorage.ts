import { Card, Rank, Suit } from './types';

export const COOKIE_NAME = 'solitaire_session';
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

export interface SavedGameData {
  stock: Card[];
  waste: Card[];
  foundations: Card[][];
  tableau: Card[][];
  drawMode: 1 | 3;
}

export interface SavedStatsData {
  score: number;
  moves: number;
  elapsedSeconds: number;
}

export interface SavedSession {
  version: number;
  timestamp: number;
  game: SavedGameData;
  initialDeck: Card[];
  stats: SavedStatsData;
}

const SUIT_TO_CHAR: Record<Suit, string> = {
  hearts: 'H',
  diamonds: 'D',
  clubs: 'C',
  spades: 'S'
};

const CHAR_TO_SUIT: Record<string, Suit> = {
  h: 'hearts',
  H: 'hearts',
  d: 'diamonds',
  D: 'diamonds',
  c: 'clubs',
  C: 'clubs',
  s: 'spades',
  S: 'spades'
};

const RANK_CHARS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'];

const CHAR_TO_RANK: Record<string, Rank> = {
  A: 1,
  '1': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  T: 10,
  '0': 10,
  J: 11,
  Q: 12,
  K: 13
};

/**
 * Encodes a single card into a 2-character string.
 * Face up = uppercase suit letter ('H', 'D', 'C', 'S').
 * Face down = lowercase suit letter ('h', 'd', 'c', 's').
 */
export function encodeCard(card: Card): string {
  const suitLetter = SUIT_TO_CHAR[card.suit] || 'H';
  const suitChar = card.isFaceUp ? suitLetter : suitLetter.toLowerCase();
  const rankChar = RANK_CHARS[card.rank] || 'A';
  return `${suitChar}${rankChar}`;
}

/**
 * Decodes a 2-character string back into a Card object.
 */
export function decodeCard(code: string): Card | null {
  if (!code || code.length !== 2) return null;
  const suitChar = code[0];
  const rankChar = code[1].toUpperCase();

  const suit = CHAR_TO_SUIT[suitChar];
  const rank = CHAR_TO_RANK[rankChar];
  if (!suit || !rank) return null;

  const isFaceUp = suitChar === suitChar.toUpperCase();
  const id = `${suit}_${rank}`;
  return { id, suit, rank, isFaceUp };
}

/**
 * Encodes an array of cards into concatenated 2-character tokens.
 */
export function encodeCards(cards: Card[]): string {
  return cards.map(encodeCard).join('');
}

/**
 * Decodes a concatenated string of 2-character card tokens.
 */
export function decodeCards(str: string): Card[] {
  if (!str || str.length % 2 !== 0) return [];
  const cards: Card[] = [];
  for (let i = 0; i < str.length; i += 2) {
    const chunk = str.substring(i, i + 2);
    const card = decodeCard(chunk);
    if (!card) return []; // Invalidate entire sequence if any card token is corrupt
    cards.push(card);
  }
  return cards;
}

/**
 * Parses a cookie value from document.cookie or a given cookie string
 */
export function getCookie(name: string, cookieSource?: string): string | null {
  const str = cookieSource !== undefined ? cookieSource : (typeof document !== 'undefined' ? document.cookie : '');
  if (!str) return null;

  const prefix = `${encodeURIComponent(name)}=`;
  const cookies = str.split(';');
  for (let i = 0; i < cookies.length; i++) {
    const c = cookies[i].trim();
    if (c.indexOf(prefix) === 0) {
      try {
        return decodeURIComponent(c.substring(prefix.length));
      } catch {
        return c.substring(prefix.length);
      }
    }
  }
  return null;
}

/**
 * Sets a cookie in document.cookie or using a provided setter
 */
export function setCookie(
  name: string,
  value: string,
  maxAgeSeconds: number = SESSION_MAX_AGE_SECONDS,
  cookieSetter?: (cookieStr: string) => void
): void {
  const encodedValue = encodeURIComponent(value);
  const secureFlag = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  const cookieStr = `${encodeURIComponent(name)}=${encodedValue}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax${secureFlag}`;
  if (cookieSetter) {
    cookieSetter(cookieStr);
  } else if (typeof document !== 'undefined') {
    document.cookie = cookieStr;
  }
}

/**
 * Deletes a cookie by setting max-age to 0
 */
export function deleteCookie(name: string, cookieSetter?: (cookieStr: string) => void): void {
  const secureFlag = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  const cookieStr = `${encodeURIComponent(name)}=; path=/; max-age=0; SameSite=Lax${secureFlag}`;
  if (cookieSetter) {
    cookieSetter(cookieStr);
  } else if (typeof document !== 'undefined') {
    document.cookie = cookieStr;
  }
}

/**
 * Serializes a SavedSession object into a compact string (~250 bytes)
 * Format: v1|drawMode:score:moves:elapsedSeconds|initialDeck|stock|waste|f0.f1.f2.f3|t0.t1.t2.t3.t4.t5.t6
 */
export function serializeSession(session: SavedSession): string {
  const stats = `${session.game.drawMode}:${session.stats.score}:${session.stats.moves}:${session.stats.elapsedSeconds}`;
  const initialDeck = encodeCards(session.initialDeck);
  const stock = encodeCards(session.game.stock);
  const waste = encodeCards(session.game.waste);
  const foundations = session.game.foundations.map(f => encodeCards(f)).join('.');
  const tableau = session.game.tableau.map(col => encodeCards(col)).join('.');

  return `v1|${stats}|${initialDeck}|${stock}|${waste}|${foundations}|${tableau}`;
}

/**
 * Deserializes and validates a SavedSession from a serialized string
 */
export function deserializeSession(serialized: string): SavedSession | null {
  if (!serialized) return null;

  try {
    // Check if it's the compact v1 format
    if (serialized.startsWith('v1|')) {
      const parts = serialized.split('|');
      if (parts.length < 7) return null;

      const statsPart = parts[1].split(':');
      const drawMode = parseInt(statsPart[0], 10) as 1 | 3;
      if (drawMode !== 1 && drawMode !== 3) return null;

      const score = Math.max(0, parseInt(statsPart[1], 10) || 0);
      const moves = Math.max(0, parseInt(statsPart[2], 10) || 0);
      const elapsedSeconds = Math.max(0, parseInt(statsPart[3], 10) || 0);

      const initialDeck = decodeCards(parts[2]);
      const stock = decodeCards(parts[3]);
      const waste = decodeCards(parts[4]);

      const fParts = parts[5].split('.');
      if (fParts.length !== 4) return null;
      const foundations = fParts.map(str => decodeCards(str));

      const tParts = parts[6].split('.');
      if (tParts.length !== 7) return null;
      const tableau = tParts.map(str => decodeCards(str));

      // Verify total card count across piles is 52 and IDs are unique
      const allCards = [
        ...stock,
        ...waste,
        ...foundations.flat(),
        ...tableau.flat()
      ];
      if (allCards.length !== 52) return null;
      const uniqueIds = new Set(allCards.map(c => c.id));
      if (uniqueIds.size !== 52) return null;

      return {
        version: 1,
        timestamp: Date.now(),
        game: {
          stock,
          waste,
          foundations,
          tableau,
          drawMode
        },
        initialDeck: initialDeck.length === 52 ? initialDeck : [
          ...stock,
          ...waste,
          ...foundations.flat(),
          ...tableau.flat()
        ],
        stats: {
          score,
          moves,
          elapsedSeconds
        }
      };
    }

    // Fallback: JSON format (legacy/forward-compatibility)
    if (serialized.startsWith('{')) {
      const data = JSON.parse(serialized);
      if (!data || typeof data !== 'object') return null;
      const game = data.game;
      if (!game || typeof game !== 'object') return null;
      if (!Array.isArray(game.stock) || !Array.isArray(game.waste)) return null;
      if (!Array.isArray(game.foundations) || game.foundations.length !== 4) return null;
      if (!Array.isArray(game.tableau) || game.tableau.length !== 7) return null;

      const totalPilesCards =
        game.stock.length +
        game.waste.length +
        game.foundations.reduce((sum: number, f: Card[]) => sum + (Array.isArray(f) ? f.length : 0), 0) +
        game.tableau.reduce((sum: number, col: Card[]) => sum + (Array.isArray(col) ? col.length : 0), 0);

      if (totalPilesCards !== 52) return null;

      return {
        version: 1,
        timestamp: typeof data.timestamp === 'number' ? data.timestamp : Date.now(),
        game: {
          stock: game.stock,
          waste: game.waste,
          foundations: game.foundations,
          tableau: game.tableau,
          drawMode: game.drawMode === 3 ? 3 : 1
        },
        initialDeck: Array.isArray(data.initialDeck) ? data.initialDeck : [],
        stats: {
          score: Math.max(0, data.stats?.score || 0),
          moves: Math.max(0, data.stats?.moves || 0),
          elapsedSeconds: Math.max(0, data.stats?.elapsedSeconds || 0)
        }
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Saves current game session to cookie (and localStorage backup)
 */
export function saveSessionToCookie(
  session: SavedSession,
  cookieSetter?: (cookieStr: string) => void
): boolean {
  try {
    const serialized = serializeSession(session);
    setCookie(COOKIE_NAME, serialized, SESSION_MAX_AGE_SECONDS, cookieSetter);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(COOKIE_NAME, serialized);
      } catch {}
    }
    return true;
  } catch (err) {
    console.warn('Failed to save Solitaire session to cookie:', err);
    return false;
  }
}

/**
 * Loads and restores session from cookie (or localStorage fallback)
 */
export function loadSessionFromCookie(cookieGetter?: () => string): SavedSession | null {
  try {
    const rawCookie = getCookie(COOKIE_NAME, cookieGetter ? cookieGetter() : undefined);
    if (rawCookie) {
      const parsed = deserializeSession(rawCookie);
      if (parsed) return parsed;
    }

    // Fallback to localStorage if cookie not found or invalid
    if (typeof localStorage !== 'undefined') {
      try {
        const rawLocal = localStorage.getItem(COOKIE_NAME);
        if (rawLocal) {
          const parsed = deserializeSession(rawLocal);
          if (parsed) return parsed;
        }
      } catch {}
    }

    return null;
  } catch (err) {
    console.warn('Failed to load Solitaire session from cookie:', err);
    return null;
  }
}

/**
 * Clears saved session cookie and localStorage
 */
export function clearSessionCookie(cookieSetter?: (cookieStr: string) => void): void {
  deleteCookie(COOKIE_NAME, cookieSetter);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(COOKIE_NAME);
    } catch {}
  }
}
