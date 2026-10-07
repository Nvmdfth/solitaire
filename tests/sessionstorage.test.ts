import { describe, it, expect, beforeEach } from 'vitest';
import {
  SavedSession,
  serializeSession,
  deserializeSession,
  encodeCard,
  decodeCard,
  encodeCards,
  decodeCards,
  getCookie,
  setCookie,
  deleteCookie,
  saveSessionToCookie,
  loadSessionFromCookie,
  clearSessionCookie,
  COOKIE_NAME
} from '../src/core/SessionStorage';
import { GameState } from '../src/core/GameState';

describe('SessionStorage cookie serialization and persistence', () => {
  beforeEach(() => {
    // Mock document.cookie in test environment if needed
    if (typeof document !== 'undefined') {
      try {
        Object.defineProperty(document, 'cookie', {
          writable: true,
          value: ''
        });
      } catch {}
    }
  });

  const createSampleSession = (): SavedSession => {
    const game = new GameState();
    game.initGame(1);

    return {
      version: 1,
      timestamp: Date.now(),
      game: {
        stock: game.stock.map(c => ({ ...c })),
        waste: game.waste.map(c => ({ ...c })),
        foundations: game.foundations.map(f => f.map(c => ({ ...c }))),
        tableau: game.tableau.map(col => col.map(c => ({ ...c }))),
        drawMode: 1
      },
      initialDeck: [
        ...game.stock.map(c => ({ ...c })),
        ...game.tableau.map(col => col.map(c => ({ ...c }))).flat()
      ],
      stats: {
        score: 120,
        moves: 14,
        elapsedSeconds: 45
      }
    };
  };

  it('encodes and decodes cards correctly', () => {
    const card1 = { id: 'hearts_1', suit: 'hearts' as const, rank: 1 as const, isFaceUp: true };
    const encoded1 = encodeCard(card1);
    expect(encoded1).toBe('HA');
    expect(decodeCard(encoded1)).toEqual(card1);

    const card2 = { id: 'spades_13', suit: 'spades' as const, rank: 13 as const, isFaceUp: false };
    const encoded2 = encodeCard(card2);
    expect(encoded2).toBe('sK');
    expect(decodeCard(encoded2)).toEqual(card2);

    const card3 = { id: 'diamonds_10', suit: 'diamonds' as const, rank: 10 as const, isFaceUp: true };
    const encoded3 = encodeCard(card3);
    expect(encoded3).toBe('DT');
    expect(decodeCard(encoded3)).toEqual(card3);

    const cards = [card1, card2, card3];
    const encodedMultiple = encodeCards(cards);
    expect(encodedMultiple).toBe('HAsKDT');
    expect(decodeCards(encodedMultiple)).toEqual(cards);
  });

  it('serializes to an ultra-compact string well under the 4KB cookie limit', () => {
    const session = createSampleSession();
    const serialized = serializeSession(session);
    expect(serialized).toBeTypeOf('string');
    // Should be under 400 bytes (far below 4096 bytes cookie limit)
    expect(serialized.length).toBeLessThan(400);

    const restored = deserializeSession(serialized);
    expect(restored).not.toBeNull();
    expect(restored?.version).toBe(1);
    expect(restored?.stats.score).toBe(120);
    expect(restored?.stats.moves).toBe(14);
    expect(restored?.stats.elapsedSeconds).toBe(45);
    expect(restored?.game.drawMode).toBe(1);
    expect(restored?.game.tableau.length).toBe(7);
    expect(restored?.game.foundations.length).toBe(4);
    expect(restored?.game.stock.length).toBe(session.game.stock.length);
  });

  it('returns null on invalid or corrupted session data', () => {
    expect(deserializeSession('')).toBeNull();
    expect(deserializeSession('invalid-string')).toBeNull();
    expect(deserializeSession('v1|invalid')).toBeNull();
    // Incomplete piles
    expect(deserializeSession('v1|1:0:0:0||||||')).toBeNull();
  });

  it('sets, gets, and deletes cookies correctly', () => {
    let jar = '';
    const cookieSetter = (val: string) => {
      jar = val;
    };

    setCookie('test_cookie', 'hello_world', 3600, cookieSetter);
    expect(jar).toContain('test_cookie=hello_world');

    const retrieved = getCookie('test_cookie', 'foo=bar; test_cookie=hello_world; baz=qux');
    expect(retrieved).toBe('hello_world');

    deleteCookie('test_cookie', cookieSetter);
    expect(jar).toContain('test_cookie=');
    expect(jar).toContain('max-age=0');
  });

  it('handles cookie save and load end-to-end', () => {
    const session = createSampleSession();
    let cookieStorage = '';
    const setter = (val: string) => {
      cookieStorage = val.split(';')[0];
    };

    const saved = saveSessionToCookie(session, setter);
    expect(saved).toBe(true);

    const loaded = loadSessionFromCookie(() => cookieStorage);
    expect(loaded).not.toBeNull();
    expect(loaded?.stats.score).toBe(120);
    expect(loaded?.stats.moves).toBe(14);
    expect(loaded?.stats.elapsedSeconds).toBe(45);
  });

  it('clears session cookie', () => {
    let cookieStorage = `${COOKIE_NAME}=somedata`;
    const setter = (val: string) => {
      cookieStorage = val;
    };

    clearSessionCookie(setter);
    expect(cookieStorage).toContain(`${COOKIE_NAME}=`);
    expect(cookieStorage).toContain('max-age=0');
  });

  it('includes Secure attribute when location.protocol is https:', () => {
    let jar = '';
    const cookieSetter = (val: string) => {
      jar = val;
    };

    // Mock location with https:
    const originalLocation = globalThis.location;
    try {
      (globalThis as any).location = { protocol: 'https:' };
      setCookie('secure_cookie', 'val', 3600, cookieSetter);
      expect(jar).toContain('; Secure');

      deleteCookie('secure_cookie', cookieSetter);
      expect(jar).toContain('; Secure');

      (globalThis as any).location = { protocol: 'http:' };
      setCookie('insecure_cookie', 'val', 3600, cookieSetter);
      expect(jar).not.toContain('; Secure');
    } finally {
      (globalThis as any).location = originalLocation;
    }
  });
});
