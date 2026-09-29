// منطق السلة ورسالة واتساب: دوال نقية بلا DOM حتى يمكن اختبارها (tools/test-order.mjs)
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Order = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var MAX_QTY = 99;
  var MAX_MESSAGE_CHARS = 1500;
  var GREETING = "السلام عليكم، أرغب بالطلب:";

  var numberFormat = new Intl.NumberFormat("ar", {
    numberingSystem: "latn",
    maximumFractionDigits: 2
  });

  // الأسعار تُحسب بالوحدات الصغيرة (هللة) لتفادي أخطاء الفاصلة العشرية
  function toMinor(price) {
    return typeof price === "number" && isFinite(price) && price >= 0 ? Math.round(price * 100) : null;
  }

  function formatMinor(minor, currency) {
    return (numberFormat.format(minor / 100) + " " + (currency || "")).trim();
  }

  function itemLineId(item) { return item.id; }
  function extraLineId(extra) { return "extra:" + extra.id; }
  function lineKey(lineId, label) { return lineId + "|" + (label || ""); }

  function clampQty(qty) {
    var n = Math.floor(Number(qty));
    if (!isFinite(n) || n < 1) return 0;
    return Math.min(n, MAX_QTY);
  }

  // الكتالوج: key -> { key, name, label, unitMinor } للأصناف المتوفرة وذات السعر الصالح فقط
  function buildCatalog(data) {
    var catalog = {};
    function put(lineId, name, label, price) {
      var minor = toMinor(price);
      if (!lineId || !name || minor === null) return;
      var key = lineKey(lineId, label);
      catalog[key] = { key: key, name: name, label: label || "", unitMinor: minor };
    }
    (data.items || []).forEach(function (item) {
      if (item.available === false) return;
      if (Array.isArray(item.sizes) && item.sizes.length) {
        item.sizes.forEach(function (s) { put(itemLineId(item), item.name, s.label, s.price); });
      } else {
        put(itemLineId(item), item.name, "", item.price);
      }
    });
    (data.extras || []).forEach(function (x) {
      if (x.id) put(extraLineId(x), x.name, "", x.price);
    });
    return catalog;
  }

  function addLine(lines, entry, qty) {
    var add = clampQty(qty == null ? 1 : qty);
    if (!entry || !add) return lines.slice();
    var found = false;
    var next = lines.map(function (l) {
      if (l.key !== entry.key) return l;
      found = true;
      return withQty(l, Math.min(l.qty + add, MAX_QTY));
    });
    if (!found) next.push(withQty(entry, Math.min(add, MAX_QTY)));
    return next;
  }

  function withQty(line, qty) {
    return { key: line.key, name: line.name, label: line.label, unitMinor: line.unitMinor, qty: qty };
  }

  // qty أقل من 1 يحذف السطر
  function setQty(lines, key, qty) {
    var q = clampQty(qty);
    return lines
      .map(function (l) { return l.key === key ? withQty(l, q) : l; })
      .filter(function (l) { return l.qty > 0; });
  }

  // يعيد بناء السطور من (key, qty) المحفوظة على الكتالوج الحالي: الأسعار طازجة، والمحذوف/غير المتوفر يسقط
  function reconcile(saved, catalog) {
    var lines = [];
    if (!Array.isArray(saved)) return lines;
    saved.forEach(function (s) {
      if (!s || typeof s.key !== "string") return;
      if (!Object.prototype.hasOwnProperty.call(catalog, s.key)) return;
      var qty = clampQty(s.qty);
      if (qty) lines = addLine(lines, catalog[s.key], qty);
    });
    return lines;
  }

  function totalMinor(lines) {
    return lines.reduce(function (sum, l) { return sum + l.unitMinor * l.qty; }, 0);
  }

  function count(lines) {
    return lines.reduce(function (sum, l) { return sum + l.qty; }, 0);
  }

  function buildMessage(lines, currency) {
    var rows = lines.map(function (l) {
      var name = l.label ? l.name + " (" + l.label + ")" : l.name;
      return "- " + l.qty + " × " + name + " = " + formatMinor(l.unitMinor * l.qty, currency);
    });
    return [GREETING].concat(rows, ["الإجمالي: " + formatMinor(totalMinor(lines), currency)]).join("\n");
  }

  // رقم دولي فقط: 8–15 رقمًا، لا يبدأ بصفر. غير ذلك يُعاد "" (الطلب غير مفعّل)
  function normalizeNumber(raw) {
    var digits = String(raw == null ? "" : raw).replace(/\D/g, "");
    return /^[1-9]\d{7,14}$/.test(digits) ? digits : "";
  }

  // { url, tooLong } — url = null إذا كان الرقم غير صالح أو الرسالة أطول من الحد
  function buildUrl(number, message) {
    var digits = normalizeNumber(number);
    if (!digits) return { url: null, tooLong: false };
    if (message.length > MAX_MESSAGE_CHARS) return { url: null, tooLong: true };
    return { url: "https://wa.me/" + digits + "?text=" + encodeURIComponent(message), tooLong: false };
  }

  return {
    MAX_QTY: MAX_QTY,
    MAX_MESSAGE_CHARS: MAX_MESSAGE_CHARS,
    toMinor: toMinor,
    formatMinor: formatMinor,
    itemLineId: itemLineId,
    extraLineId: extraLineId,
    lineKey: lineKey,
    buildCatalog: buildCatalog,
    addLine: addLine,
    setQty: setQty,
    reconcile: reconcile,
    totalMinor: totalMinor,
    count: count,
    buildMessage: buildMessage,
    normalizeNumber: normalizeNumber,
    buildUrl: buildUrl
  };
});
