"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDateInIndia = formatDateInIndia;
exports.formatDateTimeInIndia = formatDateTimeInIndia;
exports.toIndianDateString = toIndianDateString;
exports.toIndianISOString = toIndianISOString;
exports.toIndianDate = toIndianDate;
var INDIA_TIME_ZONE = "Asia/Kolkata";
var INDIA_TIME_ZONE_OFFSET = "+05:30";
function parseDate(value) {
    if (value == null) {
        return null;
    }
    var date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}
function formatParts(date, options) {
    var formatter = new Intl.DateTimeFormat("en-US", __assign(__assign({ timeZone: INDIA_TIME_ZONE }, options), { hour12: false }));
    var parts = formatter.formatToParts(date);
    return parts.reduce(function (acc, part) {
        if (part.type !== "literal")
            acc[part.type] = part.value;
        return acc;
    }, {});
}
function formatDateInIndia(value, options) {
    if (options === void 0) { options = {
        day: "numeric",
        month: "short",
        year: "numeric",
    }; }
    var date = parseDate(value);
    if (!date)
        return "-";
    return date.toLocaleDateString("en-IN", __assign({ timeZone: INDIA_TIME_ZONE }, options));
}
function formatDateTimeInIndia(value, options) {
    if (options === void 0) { options = {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }; }
    var date = parseDate(value);
    if (!date)
        return "-";
    return date.toLocaleString("en-IN", __assign({ timeZone: INDIA_TIME_ZONE }, options));
}
function toIndianDateString(date) {
    if (date === void 0) { date = new Date(); }
    var parts = formatParts(date, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
    return "".concat(parts.year, "-").concat(parts.month, "-").concat(parts.day);
}
function toIndianISOString(date) {
    if (date === void 0) { date = new Date(); }
    var parts = formatParts(date, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
    return "".concat(parts.year, "-").concat(parts.month, "-").concat(parts.day, "T").concat(parts.hour, ":").concat(parts.minute, ":").concat(parts.second).concat(INDIA_TIME_ZONE_OFFSET);
}
function toIndianDate(value) {
    var date = parseDate(value);
    if (!date)
        return null;
    return toIndianDateString(date);
}
