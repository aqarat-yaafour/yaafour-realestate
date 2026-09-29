(function () {
  "use strict";

  var MENU_URL = "../data/menu.json";
  var STORAGE_KEY = "falafel-cart-v1";

  // whatsapp: رقم صالح => الطلب مفعّل. catalog: key -> صنف قابل للطلب. lines: السلة الحالية
  var state = { currency: "", whatsapp: "", catalog: {}, lines: [] };

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text; // textContent فقط، لا innerHTML
    return node;
  }

  function formatPrice(price, currency) {
    return Order.formatMinor(Order.toMinor(price) || 0, currency);
  }

  function byId(id) { return document.getElementById(id); }

  // ---------- تخزين السلة (قد يفشل في الوضع الخاص، فنعمل بالذاكرة فقط) ----------
  function loadSaved() {
    try { return JSON.parse(window.localStorage.getItem(STORAGE_KEY)) || []; }
    catch (e) { return []; }
  }

  function saveCart() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(
        state.lines.map(function (l) { return { key: l.key, qty: l.qty }; })
      ));
    } catch (e) { /* تجاهل */ }
  }

  function setText(id, value) {
    var node = document.getElementById(id);
    if (node) node.textContent = value || "";
  }

  function addButton(className, key, label, content) {
    var btn = el("button", className);
    btn.type = "button";
    btn.dataset.add = key;
    btn.setAttribute("aria-label", label);
    content.forEach(function (n) { btn.appendChild(n); });
    return btn;
  }

  // lineId: معرّف السطر في السلة (id الصنف، أو extra:id للإضافة)
  function renderItem(item, currency, lineId) {
    var card = el("article", "item" + (item.available === false ? " unavailable" : ""));
    var head = el("div", "item-head");
    head.appendChild(el("h3", "item-name", item.name));
    if (typeof item.price === "number") {
      head.appendChild(el("span", "item-price", formatPrice(item.price, currency)));
    }
    card.appendChild(head);

    if (item.description) card.appendChild(el("p", "item-desc", item.description));

    if (Array.isArray(item.sizes) && item.sizes.length) {
      var list = el("ul", "sizes");
      item.sizes.forEach(function (size) {
        var key = Order.lineKey(lineId, size.label);
        var li = el("li");
        var price = el("strong", null, formatPrice(size.price, currency));
        if (state.catalog[key]) {
          li.className = "has-add";
          li.appendChild(addButton("chip-add", key, "أضف " + item.name + " (" + size.label + ") إلى الطلب",
            [document.createTextNode(size.label + " "), price, el("span", "plus", "+")]));
        } else {
          li.appendChild(document.createTextNode(size.label + " "));
          li.appendChild(price);
        }
        list.appendChild(li);
      });
      card.appendChild(list);
    } else if (typeof item.price === "number" && state.catalog[Order.lineKey(lineId, "")]) {
      card.appendChild(addButton("add-btn", Order.lineKey(lineId, ""), "أضف " + item.name + " إلى الطلب",
        [document.createTextNode("+ أضف إلى الطلب")]));
    }

    if (item.available === false) card.appendChild(el("span", "badge-out", "غير متوفر حاليًا"));
    return card;
  }

  function renderMenu(data) {
    var info = data.restaurant || {};
    var currency = info.currency || "";
    state.currency = currency;
    state.whatsapp = Order.normalizeNumber(info.whatsapp);
    // بدون رقم صالح لا نعرض أزرار الإضافة (الطلب غير مفعّل)
    state.catalog = state.whatsapp ? Order.buildCatalog(data) : {};
    state.lines = Order.reconcile(loadSaved(), state.catalog);
    var main = document.getElementById("menu");
    var nav = document.getElementById("category-nav");
    main.textContent = "";
    nav.textContent = "";

    document.title = "المنيو | " + (info.name || "");
    setText("restaurant-name", info.name);
    setText("restaurant-tagline", info.tagline);
    setText("restaurant-hours", info.hours);
    setText("restaurant-note", info.note);

    (data.categories || []).forEach(function (cat) {
      var items = (data.items || []).filter(function (i) { return i.category === cat.id; });
      if (!items.length) return; // لا نعرض تصنيفًا فارغًا

      var section = el("section", "category");
      section.id = "cat-" + cat.id;
      section.appendChild(el("h2", null, cat.name));
      items.forEach(function (item) { section.appendChild(renderItem(item, currency, Order.itemLineId(item))); });
      main.appendChild(section);

      var link = el("a", null, cat.name);
      link.href = "#" + section.id;
      nav.appendChild(link);
    });

    if (Array.isArray(data.extras) && data.extras.length) {
      var extras = el("section", "category extras");
      extras.id = "cat-extras";
      extras.appendChild(el("h2", null, "الإضافات"));
      data.extras.forEach(function (x) {
        extras.appendChild(renderItem({ name: x.name, price: x.price }, currency, Order.extraLineId(x)));
      });
      main.appendChild(extras);
      var extrasLink = el("a", null, "الإضافات");
      extrasLink.href = "#cat-extras";
      nav.appendChild(extrasLink);
    }

    if (!main.children.length) {
      main.appendChild(el("p", "status", "المنيو فارغة حاليًا."));
    }

    renderOrder();

    watchActiveCategory(nav);
  }

  // ---------- السلة ----------
  function announce(text) {
    var live = byId("order-live");
    live.textContent = "";
    live.textContent = text; // إعادة الضبط تجعل القارئ ينطق الرسالة نفسها مرة أخرى
  }

  function changeLines(next) {
    state.lines = next;
    saveCart();
    renderOrder();
  }

  function stepButton(key, delta, label, text) {
    var b = el("button", "qty-btn", text);
    b.type = "button";
    b.dataset.key = key;
    b.dataset.delta = String(delta);
    b.setAttribute("aria-label", label);
    return b;
  }

  function renderOrder() {
    var bar = byId("order-bar");
    var sheet = byId("order-sheet");
    var toggle = byId("order-toggle");
    var link = byId("whatsapp-btn");
    var warning = byId("order-warning");

    if (!state.whatsapp || !state.lines.length) {
      bar.hidden = true;
      sheet.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      return;
    }
    bar.hidden = false;

    var total = Order.formatMinor(Order.totalMinor(state.lines), state.currency);
    toggle.textContent = "طلبك (" + Order.count(state.lines) + ") · " + total;

    var list = byId("order-lines");
    list.textContent = "";
    state.lines.forEach(function (l) {
      var li = el("li", "order-line");
      var name = l.label ? l.name + " (" + l.label + ")" : l.name;
      var info = el("div", "order-line-info");
      info.appendChild(el("span", "order-line-name", name));
      info.appendChild(el("span", "order-line-price", Order.formatMinor(l.unitMinor * l.qty, state.currency)));
      var ctl = el("div", "order-line-ctl");
      ctl.appendChild(stepButton(l.key, 1, "زيادة " + name, "+"));
      ctl.appendChild(el("span", "order-line-qty", String(l.qty)));
      ctl.appendChild(stepButton(l.key, -1, l.qty === 1 ? "حذف " + name : "تقليل " + name, l.qty === 1 ? "×" : "−"));
      li.appendChild(info);
      li.appendChild(ctl);
      list.appendChild(li);
    });

    var result = Order.buildUrl(state.whatsapp, Order.buildMessage(state.lines, state.currency));
    if (result.url) {
      link.href = result.url;
      link.removeAttribute("aria-disabled");
      warning.hidden = true;
    } else {
      link.removeAttribute("href");
      link.setAttribute("aria-disabled", "true");
      warning.textContent = "الطلب كبير جدًا للإرسال دفعة واحدة. قلّل الأصناف أو أرسله على دفعتين.";
      warning.hidden = false;
      sheet.hidden = false; // لنُظهر التحذير
      toggle.setAttribute("aria-expanded", "true");
    }
  }

  function bindOrderEvents() {
    byId("menu").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-add]");
      if (!btn) return;
      var entry = state.catalog[btn.dataset.add];
      if (!entry) return;
      changeLines(Order.addLine(state.lines, entry, 1));
      announce("تمت إضافة " + entry.name + (entry.label ? " (" + entry.label + ")" : "") + " إلى الطلب");
    });

    byId("order-lines").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-key]");
      if (!btn) return;
      var line = state.lines.filter(function (l) { return l.key === btn.dataset.key; })[0];
      if (!line) return;
      changeLines(Order.setQty(state.lines, line.key, line.qty + Number(btn.dataset.delta)));
    });

    byId("order-clear").addEventListener("click", function () {
      changeLines([]);
      announce("تم إفراغ الطلب");
    });

    byId("order-toggle").addEventListener("click", function () {
      var sheet = byId("order-sheet");
      sheet.hidden = !sheet.hidden;
      this.setAttribute("aria-expanded", String(!sheet.hidden));
    });

    byId("whatsapp-btn").addEventListener("click", function (e) {
      if (this.getAttribute("aria-disabled") === "true") e.preventDefault();
    });

    document.addEventListener("keydown", function (e) {
      var sheet = byId("order-sheet");
      if (e.key === "Escape" && !sheet.hidden) {
        sheet.hidden = true;
        byId("order-toggle").setAttribute("aria-expanded", "false");
        byId("order-toggle").focus();
      }
    });
  }

  // يلوّن التصنيف الظاهر حاليًا في الشريط العلوي
  function watchActiveCategory(nav) {
    if (!("IntersectionObserver" in window)) return;
    var links = {};
    Array.prototype.forEach.call(nav.querySelectorAll("a"), function (a) {
      links[a.getAttribute("href").slice(1)] = a;
    });
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        Object.keys(links).forEach(function (id) {
          links[id].classList.remove("active");
          links[id].removeAttribute("aria-current");
        });
        var active = links[entry.target.id];
        if (active) {
          active.classList.add("active");
          active.setAttribute("aria-current", "true");
          active.scrollIntoView({ block: "nearest", inline: "center" });
        }
      });
    }, { rootMargin: "-80px 0px -70% 0px" });
    Array.prototype.forEach.call(document.querySelectorAll(".category"), function (s) {
      observer.observe(s);
    });
  }

  function showError() {
    var main = document.getElementById("menu");
    main.textContent = "";
    var msg = el("p", "status error", "تعذّر تحميل المنيو. تأكد من اتصالك بالإنترنت ثم ");
    var retry = el("a", null, "أعد المحاولة");
    retry.href = "#";
    retry.addEventListener("click", function (e) { e.preventDefault(); load(); });
    msg.appendChild(retry);
    main.appendChild(msg);
  }

  function load() {
    // no-cache: حتى يظهر تعديل السعر فور نشره
    fetch(MENU_URL, { cache: "no-cache" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(renderMenu)
      .catch(function (err) {
        console.error(err);
        showError();
      });
  }

  bindOrderEvents();
  load();
})();
