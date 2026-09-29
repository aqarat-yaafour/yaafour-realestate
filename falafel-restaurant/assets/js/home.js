(function () {
  "use strict";

  function byId(id) { return document.getElementById(id); }

  function setText(id, value) {
    var node = byId(id);
    if (node && value) node.textContent = value; // textContent فقط
  }

  function show(id, href) {
    var a = byId(id);
    if (!a) return;
    a.href = href;
    a.hidden = false;
  }

  // https فقط، حتى لا يُحقن javascript: أو غيره
  function safeHttpsUrl(value) {
    try {
      var u = new URL(String(value || ""));
      return u.protocol === "https:" ? u.href : "";
    } catch (e) { return ""; }
  }

  function telHref(raw) {
    var s = String(raw || "").trim();
    var digits = s.replace(/\D/g, "");
    return digits.length >= 6 && digits.length <= 15 ? "tel:" + (s.charAt(0) === "+" ? "+" : "") + digits : "";
  }

  function renderStatus(info) {
    var badge = byId("home-status");
    var open = Hours.isOpen(info.schedule, info.timezone);
    if (open === null) { badge.hidden = true; return; }
    badge.hidden = false;
    badge.className = "open-badge " + (open ? "is-open" : "is-closed");
    badge.textContent = "";
    var dot = document.createElement("span");
    dot.className = "dot";
    dot.setAttribute("aria-hidden", "true");
    badge.appendChild(dot);
    badge.appendChild(document.createTextNode(open ? "مفتوح الآن" : "مغلق الآن"));
  }

  function render(data) {
    var info = data.restaurant || {};
    if (info.name) document.title = info.name;
    setText("home-name", info.name);
    setText("home-tagline", info.tagline);
    setText("home-hours", info.hours);
    setText("home-address", info.address);

    var wa = Order.normalizeNumber(info.whatsapp);
    if (wa) show("home-wa", "https://wa.me/" + wa + "?text=" + encodeURIComponent("السلام عليكم"));
    var tel = telHref(info.phone);
    if (tel) show("home-call", tel);
    var map = safeHttpsUrl(info.mapsUrl);
    if (map) show("home-map", map);

    renderStatus(info);
    setInterval(function () { renderStatus(info); }, 60000);
  }

  // فشل التحميل لا يُظهر خطأ: تبقى الصفحة الثابتة (الاسم وزر المنيو) كما هي
  fetch("data/menu.json", { cache: "no-cache" })
    .then(function (res) { if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
    .then(render)
    .catch(function (err) { console.error(err); });
})();
