import { useMemo } from "react";
import { BookOpen, CalendarDays, Funnel } from "lucide-react";
import { Button } from "../ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { PaymentsFilterPopover } from "./PaymentsFilterPopover";

export type PaymentLedgerRow = {
  id: string;
  tenant_id: string;
  hostel_name: string;
  tenant_name: string;
  room_number: string | null;
  amount: number;
  method: string | null;
  status: string;
  paid_on: string;
  billing_end: string | null;
};

export type PaymentLedgerTenant = {
  id: string;
  hostel_id: string;
  hostel_name: string;
  room_number: string | null;
  full_name: string;
  agreed_rent_amount: number | null;
  status: string;
  rent_start_date?: string | null;
  join_date?: string | null;
  move_out_date?: string | null;
};

type PaymentsLedgerProps = {
  payments: PaymentLedgerRow[];
  tenants: PaymentLedgerTenant[];
  hostels: { id: string; name: string }[];
  hostelFilter: string;
  fromDate: string;
  toDate: string;
  hasActiveFilters: boolean;
  onHostelChange: (value: string) => void;
  onClear: () => void;
  formatAmount: (amount: number) => string;
  formatDate: (value: string) => string;
};

function compareRooms(left: string | null, right: string | null) {
  const leftValue = (left ?? "").trim();
  const rightValue = (right ?? "").trim();
  const leftGround = /^(g|gf|ground)/i.test(leftValue);
  const rightGround = /^(g|gf|ground)/i.test(rightValue);
  if (leftGround !== rightGround) return leftGround ? -1 : 1;
  return leftValue.localeCompare(rightValue, undefined, { numeric: true, sensitivity: "base" });
}

function formatTenantStatus(status: string | null | undefined) {
  const normalized = (status ?? "").toLowerCase();
  const labelMap: Record<string, string> = {
    pending: "Pending",
    active: "Active",
    moved_out: "Moved Out",
    rejected: "Rejected",
  };

  return labelMap[normalized] ?? "Profile Status";
}

export function PaymentsLedger({
  payments,
  tenants,
  hostels,
  hostelFilter,
  fromDate,
  toDate,
  hasActiveFilters,
  onHostelChange,
  onClear,
  formatAmount,
  formatDate,
}: PaymentsLedgerProps) {
  const passbookRows = useMemo(() => {
    return tenants
      .filter((tenant) => {
        if (hostelFilter !== "all" && tenant.hostel_id !== hostelFilter) return false;
        const rentStartDate = tenant.rent_start_date ?? tenant.join_date ?? "";
        if (rentStartDate && toDate && rentStartDate > toDate) return false;

        const hasPaidThisMonth = payments.some(
          (payment) =>
            payment.tenant_id === tenant.id &&
            payment.status === "paid" &&
            (!fromDate || payment.paid_on >= fromDate) &&
            (!toDate || payment.paid_on <= toDate),
        );

        if (tenant.status === "moved_out") {
          return hasPaidThisMonth;
        }

        if (!tenant.room_number) {
          return hasPaidThisMonth;
        }

        return true;
      })
      .map((tenant) => {
        const rentStartDate = tenant.rent_start_date ?? tenant.join_date ?? "";
        const tenantPayments = payments.filter(
          (payment) =>
            payment.tenant_id === tenant.id &&
            (!rentStartDate || payment.paid_on >= rentStartDate) &&
            (!toDate || payment.paid_on <= toDate),
        );
        const rangePayments = tenantPayments.filter(
          (payment) => !fromDate || payment.paid_on >= fromDate,
        );
        const latestPaidPayment = tenantPayments
          .filter((payment) => payment.status === "paid" && payment.billing_end)
          .sort((a, b) => (b.billing_end ?? "").localeCompare(a.billing_end ?? ""))[0];
        const billingEnd =
          latestPaidPayment?.billing_end ??
          (tenant.status === "moved_out" && tenant.move_out_date ? tenant.move_out_date : null);
        const isRentCovered = Boolean(
          billingEnd && (!toDate || billingEnd >= toDate),
        );
        const received = rangePayments
          .filter((payment) => payment.status === "paid")
          .reduce((total, payment) => total + Number(payment.amount || 0), 0);
        const pending = isRentCovered ? 0 : Number(tenant.agreed_rent_amount || 0);
        return {
          ...tenant,
          received,
          pending,
          isRentCovered,
          billingEnd,
        };
      })
      .sort((a, b) => a.hostel_name.localeCompare(b.hostel_name) || compareRooms(a.room_number, b.room_number));
  }, [fromDate, hostelFilter, payments, tenants, toDate]);

  const propertyGroups = useMemo(() => {
    const groups = new Map<string, { name: string; rows: typeof passbookRows }>();
    for (const row of passbookRows) {
      const current = groups.get(row.hostel_id) ?? { name: row.hostel_name, rows: [] };
      current.rows.push(row);
      groups.set(row.hostel_id, current);
    }
    return Array.from(groups.values());
  }, [passbookRows]);

  function renderPropertySection(property: (typeof propertyGroups)[number]) {
    const receivedTotal = property.rows.reduce((total, row) => total + row.received, 0);
    const pendingTotal = property.rows.reduce((total, row) => total + row.pending, 0);

    return (
      <section key={property.name} className="overflow-hidden rounded-xl border border-border/70 bg-card">
        <div className="border-b border-border/70 px-3 py-3">
          <h3 className="text-sm font-semibold text-foreground">{property.name}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-left text-[13px]">
            <thead className="bg-muted text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-3 py-2">Tenant / Room</th>
                <th className="px-3 py-2">Billing Covered Until</th>
                <th className="px-3 py-2 text-right">Amount Received</th>
                <th className="px-3 py-2 text-right">Amount Pending</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-background">
              {property.rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/50">
                  <td className="px-3 py-2 text-foreground">
                    <div>{row.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.room_number ? `Room ${row.room_number}` : `Status: ${formatTenantStatus(row.status)}`}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {row.billingEnd ? formatDate(row.billingEnd) : "Not covered"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-emerald-600">{formatAmount(row.received)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-amber-600">{formatAmount(row.pending)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-border bg-muted/50">
              <tr>
                <td className="px-3 py-3 font-semibold text-foreground" colSpan={2}>Total</td>
                <td className="whitespace-nowrap px-3 py-3 text-right font-bold text-emerald-600">{formatAmount(receivedTotal)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right font-bold text-amber-600">{formatAmount(pendingTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    );
  }

  return (
    <div id="payment-ledger-panel" role="tabpanel" aria-labelledby="payment-ledger-tab" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex min-w-0 items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
          <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
          <p className="truncate text-xs font-semibold text-foreground">
            {fromDate && toDate ? `${formatDate(fromDate)} - ${formatDate(toDate)}` : "All dates"}
          </p>
        </div>
        <PaymentsFilterPopover
          showStatus={false}
          hostelFilter={hostelFilter}
          statusFilter="all"
          fromDate={fromDate}
          toDate={toDate}
          hostels={hostels}
          hasActiveFilters={hasActiveFilters}
          onHostelChange={onHostelChange}
          onStatusChange={() => {}}
          showDateRange={false}
          onFromDateChange={() => {}}
          onToDateChange={() => {}}
          onClear={onClear}
        >
          <Button type="button" variant="outline" size="icon" aria-label="Open ledger filters" title="Open ledger filters" className="h-10 w-10 shrink-0">
            <Funnel className="h-4 w-4" />
          </Button>
        </PaymentsFilterPopover>
      </div>

      {passbookRows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <BookOpen className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">No passbook entries found</p>
          <p className="text-xs text-muted-foreground/70">Try adjusting the property or date filters.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {hostelFilter === "all" && propertyGroups.length > 1 ? (
            <Accordion type="multiple" className="space-y-2">
              {propertyGroups.map((property) => (
                <AccordionItem key={property.name} value={property.name} className="overflow-hidden rounded-xl border border-border/70 bg-card px-3">
                  <AccordionTrigger className="py-3 text-sm hover:no-underline">{property.name}</AccordionTrigger>
                  <AccordionContent className="pb-0">{renderPropertySection(property)}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            propertyGroups.map(renderPropertySection)
          )}
        </div>
      )}
    </div>
  );
}
