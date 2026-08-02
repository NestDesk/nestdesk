import {
  CreditCard,
  FileText,
  LayoutDashboard,
  Megaphone,
  UserCircle2,
  Users,
  Wrench,
} from "lucide-react";

const tenantPageDetails = [
  {
    href: "/tenant/dashboard",
    title: "Dashboard",
    description: "Review your stay, rent status, and important account updates.",
    icon: LayoutDashboard,
  },
  {
    href: "/tenant/profile",
    title: "My Profile",
    description: "Manage your personal details, documents, and stay information.",
    icon: UserCircle2,
  },
  {
    href: "/tenant/payments",
    title: "Payments",
    description: "View rent history, payment status, and receipts.",
    icon: CreditCard,
  },
  {
    href: "/tenant/notices",
    title: "Notices",
    description: "Read announcements and updates from your property.",
    icon: Megaphone,
  },
  {
    href: "/tenant/maintenance",
    title: "Maintenance",
    description: "Raise issues and track the progress of your maintenance requests.",
    icon: Wrench,
  },
  {
    href: "/tenant/support-staff",
    title: "Support Staff",
    description: "Find the property contacts available to help you.",
    icon: Users,
  },
  {
    href: "/tenant/terms",
    title: "Terms & Conditions",
    description: "Review property rules, terms, and important contacts.",
    icon: FileText,
  },
] as const;

export function getTenantPageDetails(pathname: string) {
  return tenantPageDetails.find(
    ({ href }) => pathname === href || pathname.startsWith(`${href}/`),
  );
}
