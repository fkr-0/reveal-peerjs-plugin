/**
 * Small deterministic PRNG used by the Arena simulation.
 *
 * The Hub is authoritative, but deriving every simulation random value from
 * the round seed still makes bug reports and tests reproducible.
 */
export function createSeededRandom(seed) {
  let state = (Number(seed) >>> 0) || 0x6d2b79f5;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomInt(random, maxExclusive) {
  const max = Math.max(0, Math.floor(maxExclusive));
  return max > 0 ? Math.floor(random() * max) : 0;
}

