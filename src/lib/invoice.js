"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDateShort = formatDateShort;
exports.formatBillingPeriod = formatBillingPeriod;
exports.invoiceHtml = invoiceHtml;
exports.printInvoice = printInvoice;
// eslint-disable-next-line @typescript-eslint/no-require-imports
var date_1 = require("./date");
function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}
function formatDateShort(dateStr) {
  return (0, date_1.formatDateInIndia)(dateStr, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
function formatBillingPeriod(payment) {
  if (payment.billing_start && payment.billing_end) {
    return ""
      .concat(formatDateShort(payment.billing_start), " - ")
      .concat(formatDateShort(payment.billing_end));
  }
  var date = new Date(payment.month);
  var startDate = new Date(date.getFullYear(), date.getMonth(), 1);
  var endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  var fmt = function (d) {
    return (0, date_1.formatDateInIndia)(d, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).replace(/ /g, "-");
  };
  return "".concat(fmt(startDate), " - ").concat(fmt(endDate));
}
function formatAddress(address) {
  if (!(address === null || address === void 0 ? void 0 : address.trim())) return "";
  var segments = address
    .split(",")
    .map(function (segment) {
      return segment.trim();
    })
    .filter(Boolean);
  if (segments.length >= 2) {
    return segments.join("<br />");
  }
  var fallback = address.trim();
  var splitPosition = Math.max(
    fallback.indexOf(" ", Math.floor(fallback.length / 2)),
    fallback.indexOf(" ", Math.floor(fallback.length / 3)),
  );
  if (splitPosition > 0) {
    return ""
      .concat(fallback.slice(0, splitPosition).trim(), "<br />")
      .concat(fallback.slice(splitPosition + 1).trim());
  }
  return fallback;
}
function renderPropertyAddress(payment) {
  var _a, _b, _c, _d, _e;
  var defaultAddressParts = [];
  if ((_a = payment.hostel_address) === null || _a === void 0 ? void 0 : _a.trim()) {
    defaultAddressParts.push(payment.hostel_address.trim());
  }
  var cityStateParts = [
    (_b = payment.hostel_city) === null || _b === void 0 ? void 0 : _b.trim(),
    (_c = payment.hostel_state) === null || _c === void 0 ? void 0 : _c.trim(),
  ].filter(Boolean);
  if (cityStateParts.length > 0) {
    defaultAddressParts.push(cityStateParts.join(", "));
  }
  if ((_d = payment.hostel_pincode) === null || _d === void 0 ? void 0 : _d.trim()) {
    defaultAddressParts.push(payment.hostel_pincode.trim());
  }
  var fallbackAddress = defaultAddressParts.join(", ");
  var addressText =
    ((_e = payment.hostel_billing_address) === null || _e === void 0
      ? void 0
      : _e.trim()) ||
    fallbackAddress ||
    "";
  var formatted = formatAddress(addressText);
  return formatted
    ? '<div class="property-address">'.concat(formatted, "</div>")
    : "";
}
function renderGstOrPan(payment) {
  var gstOrPan = payment.hostel_gst_number
    ? { label: "GST", value: payment.hostel_gst_number }
    : payment.hostel_pan_number
      ? { label: "PAN", value: payment.hostel_pan_number }
      : null;
  if (!gstOrPan) return "";
  return '<div class="gst-row"><div class="meta-label">'
    .concat(gstOrPan.label, '</div><div class="meta-value">')
    .concat(gstOrPan.value, "</div></div>");
}
function invoiceHtml(payment) {
  var _a, _b, _c;
  var billingPeriod = formatBillingPeriod(payment);
  var methodLabel = payment.method ? payment.method : "—";
  var statusLabel = payment.status.charAt(0).toUpperCase() + payment.status.slice(1);
  var propertyAddressHtml = renderPropertyAddress(payment);
  var gstHtml = renderGstOrPan(payment);
  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>Invoice '
    .concat(
      (_a = payment.receipt_number) !== null && _a !== void 0 ? _a : "",
      '</title>\n  <style>\n    * { margin: 0; padding: 0; box-sizing: border-box; }\n    body { font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111827; padding: 28px 28px; max-width: 640px; margin: 0 auto; background: #fff; }\n    .header { display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: start; margin-bottom: 12px; }\n    .property { font-size: 18px; font-weight: 800; color: #111827; line-height: 1.2; }\n    .property-sub { font-size: 11px; color: #4b5563; margin-top: 6px; line-height: 1.4; white-space: pre-wrap; }\n    .meta-block { text-align: right; min-width: 140px; }\n    .meta-row, .gst-row { display: flex; justify-content: space-between; gap: 12px; align-items: center; margin-bottom: 8px; }\n    .meta-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin-bottom: 4px; }\n    .meta-value { font-size: 13px; font-weight: 600; color: #111827; line-height: 1.3; }\n    .meta-value.receipt { font-size: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; letter-spacing: 0.4px; }\n    .footer { margin-top: 16px; font-size: 10px; color: #9ca3af; text-align: center; line-height: 1.5; letter-spacing: 0.2px; }\n    hr { border: none; border-top: 1px solid #e5e7eb; margin: 18px 0; }\n    .section-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin-bottom: 6px; }\n    .tenant-name { font-size: 15px; font-weight: 700; color: #111827; line-height: 1.3; }\n    .tenant-sub { font-size: 12px; color: #4b5563; margin-top: 3px; line-height: 1.4; }\n    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 24px; margin-top: 4px; }\n    .detail-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; }\n    .detail-value { font-size: 13px; font-weight: 600; color: #111827; margin-top: 4px; line-height: 1.4; }\n    .status-pill { padding: 4px 12px; border-radius: 9999px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; background: #dcfce7; color: #166534; }\n    .status-pill.disputed { background: #f3e8ff; color: #6b21a8; }\n    .notes { margin-top: 16px; font-size: 12px; color: #475569; line-height: 1.6; }\n    @media print {\n      body { padding: 20px 20px; }\n      @page { margin: 0.5in; }\n    }\n  </style>\n</head>\n<body>\n  <div class="header">\n    <div>\n      <div class="property">',
    )
    .concat(payment.hostel_name, '</div>\n      <div class="property-sub">')
    .concat(
      propertyAddressHtml,
      '</div>\n    </div>\n    <div class="meta-block">\n      <div class="meta-row">\n        <div class="meta-label">Receipt / Invoice</div>\n        <div class="meta-value receipt">',
    )
    .concat(
      (_b = payment.receipt_number) !== null && _b !== void 0 ? _b : "—",
      "</div>\n      </div>\n      ",
    )
    .concat(
      gstHtml,
      '\n      <div class="meta-row">\n        <div class="meta-label">Date Issued</div>\n        <div class="meta-value">',
    )
    .concat(
      formatDateShort(payment.paid_on),
      '</div>\n      </div>\n    </div>\n  </div>\n\n  <div class="section-label">Billed To</div>\n  <div class="tenant-name">',
    )
    .concat(
      (_c = payment.tenant_name) !== null && _c !== void 0 ? _c : "Tenant",
      '</div>\n  <div class="tenant-sub">',
    )
    .concat(
      payment.room_number ? "Room ".concat(payment.room_number, " \u00B7 ") : "",
    )
    .concat(
      payment.hostel_name,
      '</div>\n\n  <hr />\n\n  <div class="grid">\n    <div>\n      <div class="detail-label">Billing Period</div>\n      <div class="detail-value">',
    )
    .concat(
      billingPeriod,
      '</div>\n    </div>\n    <div>\n      <div class="detail-label">Payment Date</div>\n      <div class="detail-value">',
    )
    .concat(
      formatDateShort(payment.paid_on),
      '</div>\n    </div>\n    <div>\n      <div class="detail-label">Payment Method</div>\n      <div class="detail-value">',
    )
    .concat(
      methodLabel,
      '</div>\n    </div>\n    <div>\n      <div class="detail-label">Status</div>\n      <div class="detail-value">',
    )
    .concat(
      statusLabel,
      '</div>\n    </div>\n    <div>\n      <div class="detail-label">Amount Paid</div>\n      <div class="detail-value">',
    )
    .concat(formatCurrency(payment.amount), "</div>\n    </div>\n  </div>\n\n  ")
    .concat(
      payment.notes
        ? '<div class="notes">Note: '.concat(payment.notes, "</div>")
        : "",
      '\n  <div class="footer"> NestDesk.in: A Rental Property Management System</div>\n</body>\n</html>',
    );
}
function printInvoice(payment) {
  var html = invoiceHtml(payment);
  var win = window.open("", "_blank");
  if (!win) {
    alert("Pop-up blocked — please allow pop-ups and try again.");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(function () {
    return win.print();
  }, 300);
}
