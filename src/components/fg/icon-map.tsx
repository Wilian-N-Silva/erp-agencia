import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Boxes,
  Building2,
  CalendarClock,
  ClipboardList,
  ExternalLink,
  FileClock,
  FileText,
  Files,
  Gauge,
  KeyRound,
  Laptop,
  Repeat,
  Settings,
  UserMinus,
  UserPlus,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { NavigationIcon } from "@/components/layout/navigation-items";

export const navIconMap: Record<NavigationIcon, LucideIcon> = {
  dashboard: Gauge,
  finance: ArrowDownRight,
  "finance-in": ArrowDownRight,
  "finance-out": ArrowUpRight,
  "finance-provision": Repeat,
  clients: Building2,
  invoices: FileText,
  people: Users,
  timeoff: CalendarClock,
  documents: Files,
  reimbursements: ClipboardList,
  equipment: Laptop,
  access: KeyRound,
  saas: Boxes,
  onboarding: UserPlus,
  offboarding: UserMinus,
  alerts: Bell,
  audit: FileClock,
  settings: Settings,
  portal: ExternalLink,
};

export function NavIcon({
  name,
  size = 16,
}: {
  name: NavigationIcon;
  size?: number;
}) {
  const Icon = navIconMap[name] ?? UserRound;
  return <Icon size={size} aria-hidden />;
}
