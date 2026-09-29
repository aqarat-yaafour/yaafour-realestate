// حالة «مفتوح الآن / مغلق» حسب المنطقة الزمنية للمطعم (لا حسب جهاز الزبون). دوال نقية للاختبار.
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Hours = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // "HH:MM" -> دقائق منذ منتصف الليل. يقبل "24:00" فقط كوقت إغلاق
  function parseTime(value, allow24) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(value == null ? "" : value).trim());
    if (!m) return null;
    var h = Number(m[1]), min = Number(m[2]);
    if (min > 59) return null;
    if (h === 24 && min === 0 && allow24) return 1440;
    return h <= 23 ? h * 60 + min : null;
  }

  function minutesNow(now, timeZone) {
    var parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(now);
    var h = 0, m = 0;
    parts.forEach(function (p) {
      if (p.type === "hour") h = Number(p.value);
      if (p.type === "minute") m = Number(p.value);
    });
    return h * 60 + m;
  }

  // يعيد true/false، أو null إذا كانت البيانات ناقصة/غير صالحة (فلا نعرض أي شارة)
  function isOpen(schedule, timeZone, now) {
    if (!schedule) return null;
    var open = parseTime(schedule.open, false);
    var close = parseTime(schedule.close, true);
    if (open === null || close === null || open === close || !timeZone) return null;
    var t;
    try { t = minutesNow(now || new Date(), timeZone); } catch (e) { return null; }
    // إغلاق قبل الفتح (مثل 18:00 → 02:00) يعني أن الدوام يعبر منتصف الليل
    return open < close ? t >= open && t < close : t >= open || t < close;
  }

  function validTimeZone(timeZone) {
    try { new Intl.DateTimeFormat("en", { timeZone: timeZone }); return true; }
    catch (e) { return false; }
  }

  return { parseTime: parseTime, isOpen: isOpen, validTimeZone: validTimeZone };
});
