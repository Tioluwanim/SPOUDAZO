"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface Settings {
  examMode: boolean;
}

interface SettingsContextValue extends Settings {
  setExamMode: (value: boolean) => void;
}

const STORAGE_KEY = "spoudazo:settings";
const DEFAULTS: Settings = { examMode: false };

const SettingsContext = createContext<SettingsContextValue | null>(null);

function load(): Settings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

function save(settings: Settings) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  useEffect(() => {
    setSettings(load());
  }, []);

  function setExamMode(value: boolean) {
    setSettings((prev) => {
      const next = { ...prev, examMode: value };
      save(next);
      return next;
    });
  }

  return (
    <SettingsContext.Provider value={{ ...settings, setExamMode }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside <SettingsProvider>");
  return ctx;
}
