import admin from "firebase-admin";
import { logger } from "../lib/logger";

let initialized = false;

/**
 * Service-account private keys are pasted into env vars in several formats
 * depending on how the user copied them from the JSON file. This normalizes:
 *  - surrounding single/double quotes (copied straight from JSON)
 *  - escaped newlines (`\n` and `\r\n`) into real newlines
 *  - stray carriage returns
 * so the PEM parser always receives a valid multi-line key.
 */
function normalizePrivateKey(raw: string): string {
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  key = key
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n");
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
