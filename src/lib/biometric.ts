// Face ID / Touch ID unlock via WebAuthn platform authenticator.
// Stores only a credential ID locally — no server, no secrets leave the device.

const CRED_KEY = "iv.biometric.credId.v1";

const b64uToBytes = (s: string): Uint8Array => {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const bytesToB64u = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export const isBiometricSupported = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.PublicKeyCredential !== "undefined" &&
  !!navigator.credentials;

export const hasBiometric = (): boolean => !!localStorage.getItem(CRED_KEY);

export const clearBiometric = () => localStorage.removeItem(CRED_KEY);

export async function enrollBiometric(): Promise<boolean> {
  if (!isBiometricSupported()) throw new Error("Face ID isn't available on this device.");
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "FartBrains", id: window.location.hostname },
      user: { id: userId, name: "device", displayName: "This device" },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60_000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;
  if (!cred) return false;
  localStorage.setItem(CRED_KEY, bytesToB64u(cred.rawId));
  return true;
}

export async function verifyBiometric(): Promise<boolean> {
  if (!isBiometricSupported() || !hasBiometric()) return false;
  const stored = localStorage.getItem(CRED_KEY)!;
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ id: b64uToBytes(stored), type: "public-key" }],
        userVerification: "required",
        timeout: 60_000,
      },
    });
    return !!assertion;
  } catch {
    return false;
  }
}
