// Characters that read as ambiguous in most fonts (1/l/I, 0/O) are left out,
// since a generated password is meant to be read back and typed by hand too.
const LOWER = "abcdefghjkmnpqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%^&*-_=+?";
const ALL = LOWER + UPPER + DIGITS + SYMBOLS;

function randomChar(set: string): string {
  const idx = crypto.getRandomValues(new Uint32Array(1))[0] % set.length;
  return set[idx];
}

/** A random password drawn from the Web Crypto RNG, guaranteed one of each character class. */
export function generateStrongPassword(length = 16): string {
  const chars = [randomChar(LOWER), randomChar(UPPER), randomChar(DIGITS), randomChar(SYMBOLS)];
  while (chars.length < length) chars.push(randomChar(ALL));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
