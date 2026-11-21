const PIN_HASH_PREFIX = 'pbkdf2_v1';
const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const DERIVED_BITS = 256;
export const DEFAULT_MANAGER_PIN = '1234';

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

const fromHex = (hex: string): Uint8Array | null => {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
};

const constantTimeEqualBytes = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
};

const constantTimeEqualStrings = (a: string, b: string): boolean => {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  const maxLen = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < maxLen; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
};

const derivePbkdf2Bits = async (
  pin: string,
  salt: Uint8Array,
  iterations: number
): Promise<Uint8Array> => {
  if (typeof globalThis.crypto?.subtle === 'undefined') {
    throw new Error('Web Crypto API no disponible. Ejecuta la aplicación bajo HTTPS para validar el PIN de forma segura.');
  }
  const enc = new TextEncoder();
  const baseKey = await globalThis.crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derived = await globalThis.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations,
      hash: 'SHA-256'
    },
    baseKey,
    DERIVED_BITS
  );
  return new Uint8Array(derived);
};

export const isHashedPin = (value?: string | null): boolean =>
  typeof value === 'string' && value.startsWith(`${PIN_HASH_PREFIX}$`);

export const hashManagerPin = async (rawPin: string): Promise<string> => {
  const cleanPin = rawPin.trim();
  if (cleanPin.length < 4) {
    throw new Error('El PIN de gerente debe tener al menos 4 caracteres.');
  }
  if (typeof globalThis.crypto?.getRandomValues !== 'function') {
    throw new Error('Generador criptográfico no disponible en este navegador.');
  }
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const derived = await derivePbkdf2Bits(cleanPin, salt, PBKDF2_ITERATIONS);
  return `${PIN_HASH_PREFIX}$${PBKDF2_ITERATIONS}$${toHex(salt)}$${toHex(derived)}`;
};

export const verifyManagerPinCredential = async (
  candidatePin: string,
  storedHash?: string | null,
  legacyPlainPin?: string | null
): Promise<{ valid: boolean; needsMigration: boolean }> => {
  const candidate = (candidatePin || '').trim();
  if (!candidate) {
    return { valid: false, needsMigration: false };
  }

  if (storedHash && isHashedPin(storedHash)) {
    const parts = storedHash.split('$');
    if (parts.length !== 4) return { valid: false, needsMigration: false };
    const iterations = Number(parts[1]);
    const salt = fromHex(parts[2]);
    const expectedHash = fromHex(parts[3]);
    if (!Number.isInteger(iterations) || iterations < 10_000 || !salt || !expectedHash) {
      return { valid: false, needsMigration: false };
    }
    const derived = await derivePbkdf2Bits(candidate, salt, iterations);
    return {
      valid: constantTimeEqualBytes(derived, expectedHash),
      needsMigration: false
    };
  }

  const fallbackPlain = (legacyPlainPin || DEFAULT_MANAGER_PIN).trim();
  const valid = constantTimeEqualStrings(candidate, fallbackPlain);
  return {
    valid,
    needsMigration: valid
  };
};
