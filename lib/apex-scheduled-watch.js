const ALERT_STATES = new Set(["WATCH", "ARMED", "TRIGGERED", "CASCADE_ACTIVE"]);

export function buildApexAlertFingerprint(snapshot = {}) {
  const symbol = String(snapshot.symbol || "QQQ").toUpperCase();
  const state = String(snapshot.state || "DORMANT").toUpperCase();
  const direction = String(snapshot.direction || "NEUTRAL").toUpperCase();
  const trigger = String(snapshot.trigger || snapshot.nextProof || "").trim();
  const masterBucket = Math.floor(Number(snapshot.masterScore || 0) / 5) * 5;
  return [symbol, state, direction, masterBucket, trigger].join("|");
}

export function shouldSendApexAlert(snapshot = {}, previous = null) {
  const state = String(snapshot.state || "DORMANT").toUpperCase();
  if (!ALERT_STATES.has(state)) {
    return { send: false, reason: "STATE_NOT_ALERTABLE" };
  }

  if (snapshot.verified === false) {
    return { send: false, reason: "UNVERIFIED_SNAPSHOT" };
  }

  const unavailable = Array.isArray(snapshot.unavailableInputs)
    ? snapshot.unavailableInputs.filter(Boolean)
    : [];

  if (snapshot.requiredInputsComplete === false) {
    return { send: false, reason: "REQUIRED_INPUTS_MISSING", unavailableInputs: unavailable };
  }

  const fingerprint = buildApexAlertFingerprint(snapshot);
  if (!previous) {
    return { send: true, reason: "FIRST_ALERTABLE_STATE", fingerprint };
  }

  if (previous.fingerprint === fingerprint) {
    return { send: false, reason: "DUPLICATE", fingerprint };
  }

  const previousState = String(previous.state || "DORMANT").toUpperCase();
  const previousDirection = String(previous.direction || "NEUTRAL").toUpperCase();
  const previousScore = Number(previous.masterScore || 0);
  const currentScore = Number(snapshot.masterScore || 0);

  if (state !== previousState) {
    return { send: true, reason: "STATE_CHANGED", fingerprint };
  }

  if (String(snapshot.direction || "NEUTRAL").toUpperCase() !== previousDirection) {
    return { send: true, reason: "DIRECTION_CHANGED", fingerprint };
  }

  if (Math.abs(currentScore - previousScore) >= 8) {
    return { send: true, reason: "MATERIAL_SCORE_CHANGE", fingerprint };
  }

  if (snapshot.triggerChanged === true || snapshot.invalidationChanged === true) {
    return { send: true, reason: "LEVEL_MAP_CHANGED", fingerprint };
  }

  return { send: false, reason: "NO_MATERIAL_CHANGE", fingerprint };
}

export function buildApexSms(snapshot = {}) {
  const symbol = String(snapshot.symbol || "QQQ").toUpperCase();
  const state = String(snapshot.state || "WATCH").toUpperCase();
  const direction = String(snapshot.direction || "NEUTRAL").toUpperCase();
  const score = Number.isFinite(Number(snapshot.masterScore))
    ? `${Math.round(Number(snapshot.masterScore))}/100`
    : "n/a";

  const daily = snapshot?.timeframes?.daily?.state || snapshot.dailyState || "n/a";
  const weekly = snapshot?.timeframes?.weekly?.state || snapshot.weeklyState || "n/a";
  const intraday = snapshot?.timeframes?.intraday?.state || snapshot.intradayState || "n/a";
  const nextProof = snapshot.nextProof || snapshot.trigger || "Wait for confirmation.";
  const invalidation = snapshot.invalidation || "Not established.";

  const unavailable = Array.isArray(snapshot.unavailableInputs)
    ? snapshot.unavailableInputs.filter(Boolean)
    : [];

  let text = `WSH APEX | ${symbol} ${state} ${direction} | Score ${score} | ` +
    `Intra ${intraday} / 1-3D ${daily} / 1-4W ${weekly} | ` +
    `Next: ${nextProof} | Invalid: ${invalidation}`;

  if (unavailable.length) {
    text += ` | Unavailable: ${unavailable.slice(0, 3).join(", ")}`;
  }

  text += " | Research alert, not a buy signal.";
  return text.slice(0, 1200);
}

export async function sendTwilioSms({ accountSid, authToken, from, to, body }) {
  if (!accountSid || !authToken || !from || !to) {
    throw new Error("TWILIO_CONFIGURATION_INCOMPLETE");
  }

  const params = new URLSearchParams({ From: from, To: to, Body: body });
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    }
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error("TWILIO_SEND_FAILED");
    error.status = response.status;
    error.details = payload;
    throw error;
  }

  return {
    sid: payload.sid || null,
    status: payload.status || null,
    errorCode: payload.error_code || null,
  };
}
