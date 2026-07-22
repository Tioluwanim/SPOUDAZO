"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Settings, LogOut, Moon, Sun, Timer, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useSettings } from "@/lib/settings";
import { getProfile } from "@/lib/session";

export function ProfileMenu() {
  const router = useRouter();
  const { signOutUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const profile = getProfile();
  const initial = (profile?.name || "S").trim().charAt(0).toUpperCase();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSignOut() {
    await signOutUser();
    router.push("/");
  }

  return (
    <>
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Account menu"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-glow font-medium text-white transition-transform hover:scale-105 focus-ring"
        >
          {initial}
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-11 z-50 w-52 overflow-hidden rounded-xl border border-ink-border bg-ink-soft shadow-xl"
            >
              {profile?.name && (
                <div className="border-b border-ink-border px-4 py-3">
                  <p className="truncate text-sm font-medium text-paper">{profile.name}</p>
                </div>
              )}
              <button
                onClick={() => {
                  setOpen(false);
                  setSettingsOpen(true);
                }}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-paper-dim transition-colors hover:bg-ink-surface hover:text-paper focus-ring"
              >
                <Settings size={15} />
                Settings
              </button>
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-paper-dim transition-colors hover:bg-clay-alert/10 hover:text-clay-alert focus-ring"
              >
                <LogOut size={15} />
                Sign out
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      </AnimatePresence>
    </>
  );
}

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { theme, toggleTheme } = useTheme();
  const { examMode, setExamMode } = useSettings();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.97 }}
        transition={{ type: "spring", damping: 24, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-ink-border bg-ink-soft p-5 shadow-2xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-display text-lg text-paper">Settings</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-paper-dim hover:bg-ink-border hover:text-paper focus-ring"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-1">
          <SettingRow
            icon={theme === "dark" ? Moon : Sun}
            title="Dark mode"
            description="Easier on the eyes for late-night revision."
          >
            <ToggleSwitch checked={theme === "dark"} onChange={toggleTheme} />
          </SettingRow>

          <SettingRow
            icon={Timer}
            title="Exam mode"
            description="Adds a countdown timer to Theory and CBT practice, like a real exam."
          >
            <ToggleSwitch checked={examMode} onChange={setExamMode} />
          </SettingRow>
        </div>
      </motion.div>
    </motion.div>
  );
}

function SettingRow({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Moon;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl px-2 py-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-glow/10 text-amber-glow">
          <Icon size={15} />
        </span>
        <div>
          <p className="text-sm font-medium text-paper">{title}</p>
          <p className="text-xs text-paper-faint">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-ring ${
        checked ? "bg-amber-glow" : "bg-ink-border"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
