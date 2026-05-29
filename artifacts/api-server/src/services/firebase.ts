import admin from "firebase-admin";
import { logger } from "../lib/logger";

let initialized = false;

/**
 * Service-account private keys get mangled in many ways when pasted into env
 * vars: surrounding quotes, escaped `\n`, spaces instead of newlines, or the
 * whole key collapsed onto one line. Rather than guess, we rebuild the PEM from
 * scratch: strip the markers, remove ALL whitespace from the base64 body, then
 * re-wrap at 64 chars with proper BEGIN/END lines. This produces a valid key
 * regardless of how the original line breaks were lost.
 */
function normalizePrivateKey(raw: string): string {
  let key = raw.trim();

  // Strip surrounding quotes copied straight from the JSON file.
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }

  // Turn any escaped newline sequences into real newlines first.
  key = key
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  // Reconstruct the PEM if we can find the standard markers.
  const markers: Array<[string, string]> = [
    ["-----BEGIN PRIVATE KEY-----", "-----END PRIVATE KEY-----"],
    ["-----BEGIN RSA PRIVATE KEY-----", "-----END RSA PRIVATE KEY-----"],
  ];

  for (const [begin, end] of markers) {
    const startIdx = key.indexOf(begin);
    const endIdx = key.indexOf(end);
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      const body = key.slice(startIdx + begin.length, endIdx).replace(/\s+/g, "");
      const wrapped = body.match(/.{1,64}/g)?.join("\n") ?? body;
      return `${begin}\n${wrapped}\n${end}\n`;
    }
  }

  return key;
}

function init() {
  if (initialized || admin.apps.length > 0) {
    initialized = true;
    return;
  }

  const { FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL } = process.env;

  if (!FIREBASE_PROJECT_ID || !FIREBASE_PRIVATE_KEY || !FIREBASE_CLIENT_EMAIL) {
    logger.warn(
      "Firebase not configured — set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL to enable authentication",
    );
    return;
  }

  const privateKey = normalizePrivateKey(FIREBASE_PRIVATE_KEY);

  if (!privateKey.includes("BEGIN PRIVATE KEY")) {
    logger.error(
      "FIREBASE_PRIVATE_KEY does not look like a valid PEM key — make sure you pasted the full private_key value including the BEGIN/END lines",
    );
    return;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: FIREBASE_PROJECT_ID,
        privateKey,
        clientEmail: FIREBASE_CLIENT_EMAIL,
      }),
    });
    initialized = true;
    logger.info("Firebase Admin SDK initialized");
  } catch (err) {
    logger.error({ err }, "Firebase Admin SDK initialization failed");
  }
}

init();

export function isFirebaseReady(): boolean {
  return initialized;
}

export async function verifyFirebaseToken(token: string): Promise<admin.auth.DecodedIdToken> {
  if (!initialized) {
    throw new Error(
      "Firebase is not configured. Please set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL.",
    );
  }
  return admin.auth().verifyIdToken(token, true);
}

export async function getFirebaseUser(uid: string): Promise<admin.auth.UserRecord> {
  if (!initialized) throw new Error("Firebase not configured");
  return admin.auth().getUser(uid);
}

export { admin };
