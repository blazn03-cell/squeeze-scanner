import {
  buildApexAlertFingerprint,
  buildApexSms,
  sendTwilioSms,
  shouldSendApexAlert,
} from "../lib/apex-scheduled-watch.js";

function unauthorized(response) {
  return response.status(401).json({ ok: false, reason: "UNAUTHORIZED" });
}

function getBearer(request) {
  const value = request.headers?.authorization || request.headers?.Authorization || "";
  return String(value).replace(/^Bearer\s+/i, "").trim();
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`UPSTREAM_${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function readPreviousState() {
  const url = process.env.APEX_ALERT_STATE_URL;
  if (!url) return null;

  const headers = {};
  if (process.env.APEX_ALERT_STATE_TOKEN) {
    headers.Authorization = `Bearer ${process.env.APEX_ALERT_STATE_TOKEN}`;
  }

  try {
    const result = await fetchJson(url, { headers });
    return result?.state || result || null;
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

async function writeState(snapshot, fingerprint, twilio = null) {
  const url = process.env.APEX_ALERT_STATE_URL;
  if (!url) throw new Error("APEX_STATE_STORE_NOT_CONFIGURED");

  const headers = { "Content-Type": "application/json" };
  if (process.env.APEX_ALERT_STATE_TOKEN) {
    headers.Authorization = `Bearer ${process.env.APEX_ALERT_STATE_TOKEN}`;
  }

  return fetchJson(url, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      state: {
        symbol: snapshot.symbol || "QQQ",
        state: snapshot.state,
        direction: snapshot.direction,
        masterScore: snapshot.masterScore,
        fingerprint,
        lastSentAt: new Date().toISOString(),
        twilioSid: twilio?.sid || null,
        twilioStatus: twilio?.status || null,
      },
    }),
  });
}

async function getVerifiedSnapshot() {
  const url = process.env.APEX_SNAPSHOT_URL;
  if (!url) throw new Error("APEX_SNAPSHOT_URL_NOT_CONFIGURED");

  const headers = { Accept: "application/json" };
  if (process.env.APEX_SNAPSHOT_TOKEN) {
    headers.Authorization = `Bearer ${process.env.APEX_SNAPSHOT_TOKEN}`;
  }

  const snapshot = await fetchJson(url, { headers });

  if (!snapshot || typeof snapshot !== "object") {
    throw new Error("INVALID_APEX_SNAPSHOT");
  }

  // Upstream must explicitly mark the market snapshot as verified.
  // This prevents the scheduler from turning missing/guessed data into an SMS alert.
  if (snapshot.verified !== true) {
    return { ...snapshot, verified: false };
  }

  return snapshot;
}

export default async function handler(request, response) {
  if (request.method && request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ ok: false, reason: "METHOD_NOT_ALLOWED" });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && getBearer(request) !== cronSecret) {
    return unauthorized(response);
  }

  try {
    const snapshot = await getVerifiedSnapshot();
    const previous = await readPreviousState();
    const decision = shouldSendApexAlert(snapshot, previous);

    if (!decision.send) {
      return response.status(200).json({
        ok: true,
        sent: false,
        state: snapshot.state || "DORMANT",
        direction: snapshot.direction || "NEUTRAL",
        reason: decision.reason,
        unavailableInputs: decision.unavailableInputs || snapshot.unavailableInputs || [],
      });
    }

    // Persistent dedupe is required before any outbound SMS is allowed.
    // Without it, an hourly serverless cron could repeatedly text the same alert.
    if (!process.env.APEX_ALERT_STATE_URL) {
      return response.status(200).json({
        ok: true,
        sent: false,
        state: snapshot.state,
        direction: snapshot.direction,
        reason: "STATE_STORE_REQUIRED_BEFORE_SMS",
        preview: buildApexSms(snapshot),
      });
    }

    const body = buildApexSms(snapshot);
    const twilio = await sendTwilioSms({
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      from: process.env.TWILIO_FROM_NUMBER,
      to: process.env.APEX_ALERT_TO_NUMBER,
      body,
    });

    const fingerprint = decision.fingerprint || buildApexAlertFingerprint(snapshot);
    await writeState(snapshot, fingerprint, twilio);

    return response.status(200).json({
      ok: true,
      sent: true,
      state: snapshot.state,
      direction: snapshot.direction,
      reason: decision.reason,
      twilioSid: twilio.sid,
      twilioStatus: twilio.status,
    });
  } catch (error) {
    console.error("APEX scheduled watch failed", {
      message: error?.message,
      status: error?.status,
    });

    return response.status(500).json({
      ok: false,
      sent: false,
      reason: error?.message || "APEX_SCHEDULED_WATCH_FAILED",
    });
  }
}
