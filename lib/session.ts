"use client";

import type { Register } from "./types";

/**
 * Display-only profile data (name, explanation style, onboarding
 * progress). This is NOT an identity or trust boundary anymore - real
 * identity comes from Firebase (see lib/auth.tsx) and every API call is
 * authorized via a verified ID token, not anything read from here.
 * localStorage is fine for this because the worst case of tampering with
 * it is someone sees the wrong display name in their own browser.
 */
export interface SpoudazoProfile {
  name: string;
  register: Register;
  onboarded: boolean;
}

const KEY = "spoudazo:profile";

export function getProfile(): SpoudazoProfile | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SpoudazoProfile;
  } catch {
    return null;
  }
}

export function saveProfile(patch: Partial<SpoudazoProfile>): SpoudazoProfile {
  const current = getProfile() ?? { name: "", register: "coursemate" as Register, onboarded: false };
  const next = { ...current, ...patch };
  window.localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function clearProfile() {
  window.localStorage.removeItem(KEY);
}
