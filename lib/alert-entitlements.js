export function canReceiveStandardSms(user = {}) {
  return user.smsEnabled === true && user.smsOptedOut !== true;
}

export function hasApexEntitlement(user = {}) {
  // Production billing can map its real tier/entitlement into apexAccess.
  // Do not infer access from a hard-coded plan name here.
  return user.apexAccess === true;
}

export function canReceiveAlert(user = {}, alert = {}) {
  if (!canReceiveStandardSms(user)) {
    return { allowed: false, reason: user.smsOptedOut === true ? "SMS_OPTED_OUT" : "SMS_DISABLED" };
  }

  const category = String(alert.category || "STANDARD").toUpperCase();

  if (category === "APEX") {
    if (!hasApexEntitlement(user)) {
      return { allowed: false, reason: "APEX_ENTITLEMENT_REQUIRED" };
    }
  }

  return { allowed: true, reason: "ALLOWED" };
}

export function filterEligibleRecipients(users = [], alert = {}) {
  return (Array.isArray(users) ? users : []).filter((user) => canReceiveAlert(user, alert).allowed);
}
