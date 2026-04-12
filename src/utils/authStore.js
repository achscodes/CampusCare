import { loadJson, saveJson } from "./localStorage";

const USERS_KEY = "campuscare_users_v1";
const RESET_KEY = "campuscare_reset_v1";

export function getUsers() {
  const stored = loadJson(USERS_KEY, null);
  return Array.isArray(stored) && stored.length > 0 ? stored : [];
}

export function setUsers(users) {
  saveJson(USERS_KEY, users);
}

export function verifyCredentials(email, password) {
  const users = getUsers();
  const match = users.find(
    (u) => u.email.toLowerCase() === email.trim().toLowerCase(),
  );
  if (!match) return null;
  if (match.password !== password) return null;
  return match;
}

export function registerUser(newUser) {
  const users = getUsers();
  const exists = users.some(
    (u) => u.email.toLowerCase() === newUser.email.trim().toLowerCase(),
  );
  if (exists) {
    const err = new Error("Email is already registered.");
    err.code = "EMAIL_EXISTS";
    throw err;
  }
  const role = String(newUser.role || "").trim();
  const accountStatus = role === "Super Admin" ? "approved" : "pending";
  const user = { ...newUser, id: `u-${Date.now()}`, accountStatus };
  setUsers([...users, user]);
  return user;
}

export function startPasswordReset(email) {
  // Deterministic verification code makes the flow testable without email sending.
  const code = "12345678";
  const reset = {
    email: email.trim().toLowerCase(),
    code,
    createdAt: Date.now(),
    expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes
  };
  saveJson(RESET_KEY, reset);
  return code;
}

export function verifyResetCode(email, code) {
  const reset = loadJson(RESET_KEY, null);
  if (!reset) return false;
  if (reset.email !== email.trim().toLowerCase()) return false;
  if (Date.now() > reset.expiresAt) return false;
  return String(code).trim() === String(reset.code);
}

export function updatePassword(email, newPassword) {
  const users = getUsers();
  const idx = users.findIndex(
    (u) => u.email.toLowerCase() === email.trim().toLowerCase(),
  );
  if (idx === -1) return false;

  users[idx] = { ...users[idx], password: newPassword };
  setUsers(users);
  return true;
}

export function clearReset() {
  saveJson(RESET_KEY, null);
}
