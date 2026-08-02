import {
  BarChart2,
  BedDouble,
  BellRing,
  Building2,
  CreditCard,
  LayoutDashboard,
  Megaphone,
  Rocket,
  Settings,
  UserCircle2,
  Users,
  WalletCards,
  Wrench,
} from "lucide-react";

export const ownerPageDetails = [
  {
    href: "/dashboard",
    title: "Dashboard",
    description: "Monitor your properties, rent, occupancy, and cash flow.",
    icon: LayoutDashboard,
  },
  {
    href: "/hostels",
    title: "My Properties",
    description: "Add and manage your hostels, rooms, and property settings.",
    icon: Building2,
  },
  {
    href: "/tenants",
    title: "Tenants",
    description: "Manage tenant details, room assignments, and rent status.",
    icon: Users,
  },
  {
    href: "/payments",
    title: "Payments",
    description: "Track rent collections, payment history, and outstanding dues.",
    icon: CreditCard,
  },
  {
    href: "/expenses",
    title: "Expenses",
    description: "Record and review the operating expenses for your properties.",
    icon: WalletCards,
  },
  {
    href: "/occupancy",
    title: "Occupancy",
    description: "View room availability and occupancy across your properties.",
    icon: BedDouble,
  },
  {
    href: "/notices",
    title: "Notices",
    description: "Publish announcements and updates for your tenants.",
    icon: Megaphone,
  },
  {
    href: "/rent-reminders",
    title: "Rent Reminders",
    description: "Send and track reminders for upcoming or overdue rent.",
    icon: BellRing,
  },
  {
    href: "/maintenance",
    title: "Maintenance",
    description: "Track tenant requests, comments, and maintenance progress.",
    icon: Wrench,
  },
  {
    href: "/profile",
    title: "My Profile",
    description: "Manage your owner account and business profile information.",
    icon: UserCircle2,
  },
  {
    href: "/reports",
    title: "Reports",
    description: "Review performance, financial, and occupancy insights.",
    icon: BarChart2,
  },
  {
    href: "/subscriptions",
    title: "Subscriptions & Usage",
    description: "Manage your plan, usage, billing, and available features.",
    icon: Rocket,
  },
  {
    href: "/settings",
    title: "Settings",
    description: "Manage your account, properties, and preferences.",
    icon: Settings,
  },
] as const;

export function getOwnerPageDetails(pathname: string) {
  if (pathname.endsWith("/new")) {
    return {
      href: "/hostels/new",
      title: "Add Property",
      description: "Create a new property under your account.",
      icon: Building2,
    };
  }

  if (pathname.includes("/setup")) {
    return {
      href: "/hostels/setup",
      title: "Setup Property",
      description: "Configure floors, rooms, and tenant access for your property.",
      icon: Building2,
    };
  }

  return ownerPageDetails.find(
    ({ href }) => pathname === href || pathname.startsWith(`${href}/`),
  );
}

