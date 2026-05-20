import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, CreditCard, TrendingUp } from "lucide-react";

const stats = [
  {
    label: "Total Tenants",
    value: "24",
    icon: Users,
    change: "+2 this month",
    gradient: "from-blue-500/10 to-indigo-500/10",
    iconColor: "text-blue-500",
    iconBg: "bg-blue-500/10",
  },
  {
    label: "Occupied Rooms",
    value: "18 / 24",
    icon: Building2,
    change: "75% occupancy",
    gradient: "from-blue-600/10 to-indigo-500/10",
    iconColor: "text-blue-600",
    iconBg: "bg-blue-600/10",
  },
  {
    label: "Rent Collected",
    value: "Rs. 54,000",
    icon: CreditCard,
    change: "90% collected",
    gradient: "from-emerald-500/10 to-teal-500/10",
    iconColor: "text-emerald-500",
    iconBg: "bg-emerald-500/10",
  },
  {
    label: "Monthly Revenue",
    value: "Rs. 60,000",
    icon: TrendingUp,
    change: "+12% vs last",
    gradient: "from-orange-500/10 to-amber-500/10",
    iconColor: "text-orange-500",
    iconBg: "bg-orange-500/10",
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Dashboard
        </h2>
        <p className="text-muted-foreground">
          Overview of your PG, colive, hostel, and rental business
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(
          ({ label, value, icon: Icon, change, gradient, iconColor, iconBg }) => (
            <Card
              key={label}
              className={`card-hover rounded-2xl bg-gradient-to-br ${gradient} border-border/60`}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {label}
                </CardTitle>
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconBg}`}
                >
                  <Icon className={`h-4 w-4 ${iconColor}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{value}</div>
                <p className="mt-1 text-xs text-muted-foreground">{change}</p>
              </CardContent>
            </Card>
          ),
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Recent Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Payment list -- Week 4</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Room Occupancy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Room grid -- Week 2</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
