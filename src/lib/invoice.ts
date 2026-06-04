export type InvoicePayment = {
  receipt_number?: string | null;
  paid_on: string;
  hostel_name: string;
  hostel_address?: string | null;
  hostel_city?: string | null;
  hostel_state?: string | null;
  hostel_pincode?: string | null;
  hostel_billing_address?: string | null;
  hostel_gst_number?: string | null;
  hostel_pan_number?: string | null;
  tenant_name?: string | null;
  room_number?: string | null;
  amount: number;
  month: string;
  billing_start?: string | null;
  billing_end?: string | null;
  status: string;
  method?: string | null;
  notes?: string | null;
};

import { formatDateInIndia } from "@/lib/date";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDateShort(dateStr: string) {
  return formatDateInIndia(dateStr, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatBillingPeriod(payment: InvoicePayment) {
  if (payment.billing_start && payment.billing_end) {
    return `${formatDateShort(payment.billing_start)} - ${formatDateShort(
      payment.billing_end,
    )}`;
  }

  const date = new Date(payment.month);
  const startDate = new Date(date.getFullYear(), date.getMonth(), 1);
  const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const fmt = (d: Date) =>
    formatDateInIndia(d, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).replace(/ /g, "-");
  return `${fmt(startDate)} - ${fmt(endDate)}`;
}

function formatAddress(address: string | null | undefined) {
  if (!address?.trim()) return "";
  const segments = address
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length >= 2) {
    return segments.join("<br />");
  }

  const fallback = address.trim();
  const splitPosition = Math.max(
    fallback.indexOf(" ", Math.floor(fallback.length / 2)),
    fallback.indexOf(" ", Math.floor(fallback.length / 3)),
  );
  if (splitPosition > 0) {
    return `${fallback.slice(0, splitPosition).trim()}<br />${fallback
      .slice(splitPosition + 1)
      .trim()}`;
  }

  return fallback;
}

function renderPropertyAddress(payment: InvoicePayment) {
  const addressText =
    payment.hostel_billing_address?.trim() || payment.hostel_address?.trim() || "";
  const formatted = formatAddress(addressText);
  return formatted ? `<div class="property-address">${formatted}</div>` : "";
}

function renderGstOrPan(payment: InvoicePayment) {
  const gstOrPan = payment.hostel_gst_number
    ? { label: "GST", value: payment.hostel_gst_number }
    : payment.hostel_pan_number
      ? { label: "PAN", value: payment.hostel_pan_number }
      : null;

  if (!gstOrPan) return "";
  return `<div class="gst-row"><div class="meta-label">${gstOrPan.label}</div><div class="meta-value">${gstOrPan.value}</div></div>`;
}

export function invoiceHtml(payment: InvoicePayment) {
  const billingPeriod = formatBillingPeriod(payment);
  const methodLabel = payment.method ? payment.method : "—";
  const statusLabel =
    payment.status.charAt(0).toUpperCase() + payment.status.slice(1);
  const propertyAddressHtml = renderPropertyAddress(payment);
  const gstHtml = renderGstOrPan(payment);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invoice ${payment.receipt_number ?? ""}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111827; padding: 28px 28px; max-width: 640px; margin: 0 auto; background: #fff; }
    .header { display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: start; margin-bottom: 12px; }
    .property { font-size: 18px; font-weight: 800; color: #111827; line-height: 1.2; }
    .property-sub { font-size: 11px; color: #4b5563; margin-top: 6px; line-height: 1.4; white-space: pre-wrap; }
    .meta-block { text-align: right; min-width: 140px; }
    .meta-row, .gst-row { display: flex; justify-content: space-between; gap: 12px; align-items: center; margin-bottom: 8px; }
    .meta-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin-bottom: 4px; }
    .meta-value { font-size: 13px; font-weight: 600; color: #111827; line-height: 1.3; }
    .meta-value.receipt { font-size: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; letter-spacing: 0.4px; }
    .footer { margin-top: 16px; font-size: 10px; color: #9ca3af; text-align: center; line-height: 1.5; letter-spacing: 0.2px; }
    hr { border: none; border-top: 1px solid #e5e7eb; margin: 18px 0; }
    .section-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin-bottom: 6px; }
    .tenant-name { font-size: 15px; font-weight: 700; color: #111827; line-height: 1.3; }
    .tenant-sub { font-size: 12px; color: #4b5563; margin-top: 3px; line-height: 1.4; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 24px; margin-top: 4px; }
    .detail-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; }
    .detail-value { font-size: 13px; font-weight: 600; color: #111827; margin-top: 4px; line-height: 1.4; }
    .status-pill { padding: 4px 12px; border-radius: 9999px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; background: #dcfce7; color: #166534; }
    .status-pill.disputed { background: #f3e8ff; color: #6b21a8; }
    .notes { margin-top: 16px; font-size: 12px; color: #475569; line-height: 1.6; }
    @media print {
      body { padding: 20px 20px; }
      @page { margin: 0.5in; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="property">${payment.hostel_name}</div>
      <div class="property-sub">${propertyAddressHtml}</div>
    </div>
    <div class="meta-block">
      <div class="meta-row">
        <div class="meta-label">Receipt / Invoice</div>
        <div class="meta-value receipt">${payment.receipt_number ?? "—"}</div>
      </div>
      ${gstHtml}
      <div class="meta-row">
        <div class="meta-label">Date Issued</div>
        <div class="meta-value">${formatDateShort(payment.paid_on)}</div>
      </div>
    </div>
  </div>

  <div class="section-label">Billed To</div>
  <div class="tenant-name">${payment.tenant_name ?? "Tenant"}</div>
  <div class="tenant-sub">${payment.room_number ? `Room ${payment.room_number} · ` : ""}${payment.hostel_name}</div>

  <hr />

  <div class="grid">
    <div>
      <div class="detail-label">Billing Period</div>
      <div class="detail-value">${billingPeriod}</div>
    </div>
    <div>
      <div class="detail-label">Payment Date</div>
      <div class="detail-value">${formatDateShort(payment.paid_on)}</div>
    </div>
    <div>
      <div class="detail-label">Payment Method</div>
      <div class="detail-value">${methodLabel}</div>
    </div>
    <div>
      <div class="detail-label">Status</div>
      <div class="detail-value">${statusLabel}</div>
    </div>
    <div>
      <div class="detail-label">Amount Paid</div>
      <div class="detail-value">${formatCurrency(payment.amount)}</div>
    </div>
  </div>

  ${payment.notes ? `<div class="notes">Note: ${payment.notes}</div>` : ""}
  <div class="footer"> NestDesk.in: A Rental Property Management System</div>
</body>
</html>`;
}

export function printInvoice(payment: InvoicePayment) {
  const html = invoiceHtml(payment);
  const win = window.open("", "_blank");
  if (!win) {
    alert("Pop-up blocked — please allow pop-ups and try again.");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}
