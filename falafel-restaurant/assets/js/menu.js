(function () {
  "use strict";

  var MENU_URL = "../data/menu.json";
  var numberFormat = new Intl.NumberFormat("ar", {
    numberingSystem: "latn",
    maximumFractionDigits: 2
  });

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text; // textContent فقط، لا innerHTML
    return node;
  }

  function formatPrice(price, currency) {
    return numberFormat.format(price) + " " + currency;
  }

  function setText(id, value) {
    var node = document.getElementById(id);
    if (node) node.textContent = value || "";
  }

  function renderItem(item, currency) {
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
        var li = el("li", null, size.label + " ");
        li.appendChild(el("strong", null, formatPrice(size.price, currency)));
        list.appendChild(li);
      });
      card.appendChild(list);
    }

    if (item.available === false) card.appendChild(el("span", "badge-out", "غير متوفر حاليًا"));
    return card;
  }

  function renderMenu(data) {
    var info = data.restaurant || {};
    var currency = info.currency || "";
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
      items.forEach(function (item) { section.appendChild(renderItem(item, currency)); });
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
        extras.appendChild(renderItem({ name: x.name, price: x.price }, currency));
      });
      main.appendChild(extras);
      var extrasLink = el("a", null, "الإضافات");
      extrasLink.href = "#cat-extras";
      nav.appendChild(extrasLink);
    }

    if (!main.children.length) {
      main.appendChild(el("p", "status", "المنيو فارغة حاليًا."));
    }

    var wa = String(info.whatsapp || "").replace(/\D/g, "");
    if (wa) {
      var btn = document.getElementById("whatsapp-btn");
      btn.href = "https://wa.me/" + wa + "?text=" + encodeURIComponent("السلام عليكم، أرغب بالطلب:");
      btn.hidden = false;
    }

    watchActiveCategory(nav);
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
        Object.keys(links).forEach(function (id) { links[id].classList.remove("active"); });
        var active = links[entry.target.id];
        if (active) {
          active.classList.add("active");
          active.scrollIntoView({ block: "nearest", inline: "center" });
        }
      });
    }, { rootMargin: "-70px 0px -70% 0px" });
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

  load();
})();
