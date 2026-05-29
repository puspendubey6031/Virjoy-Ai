---
name: Firebase Admin private key normalization
description: How to feed a service-account private key to firebase-admin reliably
---

# Firebase Admin service-account private key

When a service-account `private_key` is stored in an env var / Replit secret, its
PEM line breaks are frequently lost or mangled (escaped `\n`, surrounding JSON
quotes, spaces instead of newlines, or the whole key on one line).
`admin.credential.cert` then fails with `error:1E08010C:DECODER routines::unsupported`.

**Rule:** Do not rely on `.replace(/\\n/g, "\n")` alone. Rebuild the PEM: strip
the BEGIN/END markers, remove ALL whitespace from the base64 body, re-wrap at 64
chars, then re-add the markers. This is format-agnostic and survives any newline
mangling.

**Why:** A stored key can have no recoverable line breaks at all, so escaped-newline
handling is insufficient; reconstruction from the base64 body is the only reliable
approach.

**How to verify:** Probe an auth route with a fake Bearer token. 503 = Admin not
initialized (bad key/env); 401 "Invalid Firebase token" = Admin working. Startup
log "Firebase Admin SDK initialized" confirms a good key.
