// Client-side encryption helpers using Web Crypto API
// Derive key with PBKDF2 and AES-GCM for encryption/decryption

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bufToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuf(base64: string) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function deriveKey(password: string, saltHex: string) {
  const salt = hexToUint8Array(saltHex);
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const key = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 200000,
      hash: 'SHA-256'
    },
  baseKey,
  { name: 'AES-GCM', length: 256 },
  // make the derived key exportable because we export it to sessionStorage in this app
  true,
  ['encrypt', 'decrypt']
  );

  return key;
}

export async function encrypt(plainText: string, key: CryptoKey) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plainText)
  );

  return {
    iv: bufToBase64(iv.buffer),
    ciphertext: bufToBase64(ciphertext)
  };
}

export async function decrypt(ciphertextBase64: string, ivBase64: string, key: CryptoKey) {
  const ctBuf = base64ToBuf(ciphertextBase64);
  const ivBuf = base64ToBuf(ivBase64);
  const plain = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(ivBuf) },
    key,
    ctBuf
  );
  return decoder.decode(plain);
}

function hexToUint8Array(hex: string) {
  if (hex.length % 2 !== 0) throw new Error('Invalid hex string');
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    arr[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return arr;
}

export function generateRandomHex(bytes = 16) {
  const arr = window.crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function exportKeyToBase64(key: CryptoKey) {
  const raw = await window.crypto.subtle.exportKey('raw', key);
  return bufToBase64(raw);
}

export async function importKeyFromBase64(base64: string) {
  const raw = base64ToBuf(base64);
  return await window.crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}
