/** Inter-office document request statuses (stored in DB as human-readable strings). */
export const INTER_OFFICE_DOC_STATUS = {
  PENDING_APPROVAL: "Pending approval",
  APPROVED: "Approved",
  DECLINED: "Declined",
  FULFILLED: "Fulfilled",
};

export function normalizeInterOfficeDocStatus(status) {
  return String(status ?? "").trim().toLowerCase();
}

/** Awaiting action from the receiving (target) office before any fulfillment upload. */
export function isDocRequestPendingApproval(status) {
  const n = normalizeInterOfficeDocStatus(status);
  return n === "pending" || n === "pending approval" || n === "pending_approval" || n === "pendingapproval";
}

export function isDocRequestApprovedForFulfillment(status) {
  const n = normalizeInterOfficeDocStatus(status);
  return n === "approved";
}

export function isDocRequestDeclined(status) {
  const n = normalizeInterOfficeDocStatus(status);
  return n === "declined" || n === "rejected";
}

export function canReceivingOfficeUploadDoc(status) {
  return isDocRequestApprovedForFulfillment(status) && !isDocRequestDeclined(status);
}

/** Discipline Office referral workflow (discipline_referrals.status). */
export const DISCIPLINE_REFERRAL_STATUS = {
  PENDING_REFERRING: "Pending referring review",
  PENDING_PARTNER: "Pending partner review",
  APPROVED: "Approved",
  DECLINED: "Declined",
};

export function normalizeReferralStatus(status) {
  return String(status ?? "").trim().toLowerCase();
}

export function isReferralPendingReferringReview(status) {
  return normalizeReferralStatus(status).includes("pending referring");
}

export function isReferralPendingPartnerReview(status) {
  const n = normalizeReferralStatus(status);
  return n.includes("pending partner");
}

/** @deprecated Referrals go straight to the partner office; no referring-office confirmation step. */
export function canReferringOfficeConfirmStudent(_status) {
  return false;
}

/** Incoming referral: receiving office may approve or decline while the referral is still open. */
export function canReceivingOfficeReviewReferral(status) {
  const n = normalizeReferralStatus(status);
  if (!n) return false;
  if (n.includes("approved") || n.includes("declined") || n.includes("rejected")) return false;
  if (n.includes("completed") || n.includes("closed")) return false;
  if (isReferralPendingPartnerReview(status)) return true;
  if (n.includes("pending referring")) return true;
  if (n === "pending" || n === "sent" || n.includes("in progress") || n.includes("in-progress")) return true;
  return false;
}
