import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, CreditCard, TrendingUp } from "lucide-react";

const stats = [
  { label: "Total Tenants", value: "24", icon: Users, change: "+2 this month" },
  {
    label: "Occupied Rooms",
    value: "18 / 24",
    icon: Building2,
    change: "75% occupancy",
  },
  {
    label: "Rent Collected",
    value: "Rs. 54,000",
    icon: CreditCard,
    change: "90% collected",
  },
  {
    label: "Monthly Revenue",
    value: "Rs. 60,000",
    icon: TrendingUp,
    change: "+12% vs last",
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
        {stats.map(({ label, value, icon: Icon, change }) => (
          <Card key={label} className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {label}
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{value}</div>
              <p className="mt-1 text-xs text-muted-foreground">{change}</p>
            </CardContent>
          </Card>
        ))}
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
