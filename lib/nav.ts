import { Home, Library, BarChart3, CalendarDays, User } from "lucide-react";

export const GLOBAL_NAV = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/library", label: "Smart Library", icon: Library },
  { href: "/planner", label: "Planner", icon: CalendarDays },
  { href: "/progress", label: "Progress", icon: BarChart3 },
  { href: "/profile", label: "Profile", icon: User },
] as const;