import { Home, Library, BarChart3, CalendarDays, User } from "lucide-react";

export const GLOBAL_NAV = [
  { href: "/dashboard", label: "Home", icon: Home, tourId: "nav-home" },
  { href: "/library", label: "Smart Library", icon: Library, tourId: "nav-library" },
  { href: "/planner", label: "Planner", icon: CalendarDays, tourId: "nav-planner" },
  { href: "/progress", label: "Progress", icon: BarChart3, tourId: "nav-progress" },
  { href: "/profile", label: "Profile", icon: User, tourId: "nav-profile" },
] as const;
