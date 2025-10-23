(() => {
  /** -----------------------------------------------------
   * CONSTANTS
   * ----------------------------------------------------- */
  const PANEL_ID = "__content_panel__";
  const HIGHLIGHT_CLASS = "__heading_highlight__";
  const INDENT_UNIT = 32;
  const MAX_Z_INDEX = "2147483647";

  /** -----------------------------------------------------
   * UTILS
   * ----------------------------------------------------- */
  const isVisible = (el) => {
    const cs = getComputedStyle(el);
    if (
      cs.display === "none" ||
      cs.visibility === "hidden" ||
      cs.opacity === "0"
    )
      return false;
    if (!(el.offsetWidth || el.offsetHeight || el.getClientRects().length))
      return false;
    if (el.closest("template,[aria-hidden='true']")) return false;
    return true;
  };

  const ownText = (el) => {
    let out = "";
    for (const n of el.childNodes)
      if (n.nodeType === Node.TEXT_NODE) out += n.textContent;
    return out.trim().replace(/\s+/g, " ");
  };

  const normalize = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();

  const SEMANTIC_OWNER_SELECTOR =
    "h1,h2,h3,h4,h5,h6,p,ul,ol,li,button,a,label,summary,figcaption,th,td,dt,dd,[role='button'],[role='link'],figure,section,article,aside,main,header,footer,nav";

  const CONTAINER_SELECTOR = [
    "a",
    "aside",
    "main",
    "footer",
    "figure",
    "div",
  ].join(",");

  function collectFreeText(rootEl) {
    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const text = node.nodeValue.replace(/\s+/g, " ").trim();
        if (!text) return NodeFilter.FILTER_REJECT;
        const parentEl = node.parentElement;
        if (!parentEl) return NodeFilter.FILTER_REJECT;
        if (!isVisible(parentEl)) return NodeFilter.FILTER_REJECT;
        if (parentEl.closest("script,style,svg"))
          return NodeFilter.FILTER_REJECT;
        const owner = parentEl.closest(SEMANTIC_OWNER_SELECTOR);
        if (owner && owner !== rootEl && rootEl.contains(owner))
          return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let chunks = [];
    let n;
    while ((n = walker.nextNode())) chunks.push(n.nodeValue);
    return chunks.join(" ").replace(/\s+/g, " ").trim();
  }

  function showTooltip(sidebar, target, text, variant = "default") {
    if (!sidebar || !target) return;

    // Reuse or create tooltip
    let tooltip = sidebar.querySelector(".tooltip");
    if (!tooltip) {
      tooltip = document.createElement("span");
      tooltip.className = "tooltip";
      sidebar.appendChild(tooltip);
    }

    tooltip.textContent = text;
    tooltip.classList.remove("error");

    if (variant === "error") tooltip.classList.add("error");

    // find the nearest scrollable parent (tree in your case)
    const scrollContainer = target.closest(".tree") || sidebar;

    const sidebarRect = sidebar.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const scrollRect = scrollContainer.getBoundingClientRect();

    // get scroll offsets from the scrollable container
    const scrollLeft = scrollContainer.scrollLeft;
    const scrollTop = scrollContainer.scrollTop;

    // Calculate position relative to sidebar coordinate system
    const left =
      targetRect.left - sidebarRect.left + targetRect.width / 2 + scrollLeft;
    const top = targetRect.bottom - scrollRect.top + scrollTop + 6;
    //  const top = targetRect.top - scrollRect.top + scrollTop + targetRect.height + 6;

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.classList.add("visible");

    // Keep tooltip within sidebar bounds
    const tooltipRect = tooltip.getBoundingClientRect();
    if (tooltipRect.right > sidebarRect.right) {
      tooltip.style.left = `${
        left - (tooltipRect.right - sidebarRect.right) - 8
      }px`;
    }
    if (tooltipRect.left < sidebarRect.left) {
      tooltip.style.left = `${Math.max(8, left)}px`;
    }
  }

  function hideTooltip(sidebar) {
    const tooltip = sidebar?.querySelector(".tooltip");

    if (tooltip) {
      tooltip.classList.remove("visible");
      tooltip.remove();
    }
  }

  /** -----------------------------------------------------
   * HIGHLIGHT OVERLAY
   * ----------------------------------------------------- */
  const highlightOverlayFollow = (el, durationMs = 1500) => {
    const ID = "__hp_highlight_box__";
    document.getElementById(ID)?.remove();

    const box = Object.assign(document.createElement("div"), {
      id: ID,
      style: `
        position:fixed;
        border:2px dashed #3b82f6;
        border-radius:4px;
        pointer-events:none;
        z-index:${MAX_Z_INDEX};
        box-sizing:border-box;
      `,
    });

    document.body.appendChild(box);

    let running = true;

    const update = () => {
      if (!running || !el.isConnected) return;
      const r = el.getBoundingClientRect();
      Object.assign(box.style, {
        left: r.left + "px",
        top: r.top + "px",
        width: r.width + "px",
        height: r.height + "px",
      });
      requestAnimationFrame(update);
    };

    const cleanup = () => {
      running = false;
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update, true);
      box.remove();
    };

    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update, true);
    requestAnimationFrame(update);
    setTimeout(cleanup, durationMs);
  };

  /** -----------------------------------------------------
   * ITEM CREATION
   * ----------------------------------------------------- */
  const createItem = (badgeText, mainText, subText, indentPx, targetEl) => {
    const item = document.createElement("div");
    item.className = "hp-item";
    item.style.marginLeft = indentPx + "px";

    const badge = Object.assign(document.createElement("span"), {
      className: "hp-badge",
      textContent: badgeText,
    });

    const main = Object.assign(document.createElement("div"), {
      className: "hp-text",
      textContent: mainText,
    });

    const textWrap = document.createElement("div");
    textWrap.className = "hp-textwrap";
    textWrap.appendChild(main);

    if (subText) {
      const sub = Object.assign(document.createElement("div"), {
        className: "hp-subtext",
        textContent: subText,
      });
      textWrap.appendChild(sub);
    }

    item.append(badge, textWrap);

    // Missing attribute detection + tooltip
    let missingType = null;

    if (badgeText === "A" && (!subText || subText === "#")) {
      missingType = "Missing href";
    }
    if (badgeText === "IMG" && (!mainText || mainText === "empty alt text")) {
      missingType = "Missing alt";
    }

    if (missingType) {
      item.classList.add("missing");

      const panel = document.getElementById(PANEL_ID);
      if (panel) {
        item.addEventListener("mouseenter", () =>
          showTooltip(panel, item, missingType, "error")
        );
        item.addEventListener("mouseleave", () => hideTooltip(panel));
      }
    }

    // Click to scroll and highlight

    item.addEventListener("click", () => {
      targetEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      const hadTabIndex = targetEl.hasAttribute("tabindex");
      if (!hadTabIndex) targetEl.setAttribute("tabindex", "-1");

      let frames = 0;
      const afterScroll = () => {
        frames++;
        if (frames < 2) return requestAnimationFrame(afterScroll);
        targetEl.focus({ preventScroll: true });
        highlightOverlayFollow(targetEl, 1500);
        if (!hadTabIndex) targetEl.removeAttribute("tabindex");
      };
      requestAnimationFrame(afterScroll);
    });

    return item;
  };

  /** -----------------------------------------------------
   * PANEL CREATION
   * ----------------------------------------------------- */
  const createPanel = () => {
    const panel = document.createElement("div");
    panel.id = PANEL_ID;

    const header = document.createElement("div");
    header.className = "hp-header";

    const title = Object.assign(document.createElement("div"), {
      className: "hp-title",
      textContent: "HTML TREE",
    });

    const closeBtn = Object.assign(document.createElement("button"), {
      className: "hp-close",
      type: "button",
      textContent: "×",
    });

    header.append(title, closeBtn);

    // Toggles
    const toggleGroup = document.createElement("div");
    toggleGroup.className = "hp-toggle-group";

    const toggles = [
      { label: "Highlight Headings", type: "headings" },
      { label: "Highlight empty href a", type: "a" },
      { label: "Highlight empty alt img", type: "img" },
    ];

    for (const t of toggles) {
      const wrap = document.createElement("div");
      wrap.className = "hp-toggle-wrap";
      wrap.innerHTML = `
        <div class="hp-title">${t.label}</div>
        <label class="hp-switch">
          <input type="checkbox" data-toggle="${t.type}">
          <span class="hp-slider"></span>
        </label>`;
      toggleGroup.appendChild(wrap);
    }

    panel.append(header, toggleGroup);

    return { panel, closeBtn };
  };

  /** -----------------------------------------------------
   * HIGHLIGHT HANDLERS
   * ----------------------------------------------------- */
  const removeHighlights = () =>
    document
      .querySelectorAll("." + HIGHLIGHT_CLASS)
      .forEach((el) => el.remove());

  const createHighlightBox = (el, labelText) => {
    const rect = el.getBoundingClientRect();
    const box = document.createElement("div");
    box.className = HIGHLIGHT_CLASS;

    Object.assign(box.style, {
      position: "absolute",
      left: window.scrollX + rect.left + "px",
      top: window.scrollY + rect.top + "px",
      width: rect.width + "px",
      height: rect.height + "px",
      border: "2px solid #f97316",
      zIndex: MAX_Z_INDEX - 1,
      pointerEvents: "none",
    });

    const label = Object.assign(document.createElement("div"), {
      textContent: labelText,
      style: `
        position:absolute;
        top:-18px;
        left:0;
        background:#f97316;
        color:#fff;
        font-size:10px;
        padding:1px 4px;
        border-radius:3px;
      `,
    });

    box.appendChild(label);
    document.body.appendChild(box);
  };

  const highlightHeadings = () =>
    document.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach((h) => {
      if (isVisible(h)) createHighlightBox(h, h.tagName);
    });

  const highlightEmptyLinks = () =>
    document.querySelectorAll("a").forEach((a) => {
      if (!isVisible(a)) return;
      const href = (a.getAttribute("href") || "").trim();
      if (!href || href === "#") createHighlightBox(a, "A");
    });

  const highlightEmptyAltImgs = () =>
    document.querySelectorAll("img").forEach((img) => {
      if (!isVisible(img)) return;
      const alt = (img.getAttribute("alt") || "").trim();
      if (!alt) createHighlightBox(img, "IMG");
    });

  /** -----------------------------------------------------
   * HTML STRUCTURE TREE
   * ----------------------------------------------------- */
  // Skip whole nav (and descendants)
  const processedNodes = new Set();
  document.body
    .querySelectorAll("nav, [role='navigation'], .navbar, .mobile-navbar")
    .forEach((nav) => {
      processedNodes.add(nav);
      nav.querySelectorAll("*").forEach((el) => processedNodes.add(el));
    });

  // Non-div owners (div inside these is skipped)
  const NON_DIV_OWNERS =
    "button,a,p,li,ul,ol,label,summary,figcaption,th,td,dt,dd,[role='button'],[role='link'],h1,h2,h3,h4,h5,h6";

  // IMPORTANT: Exclude SECTION and HEADER from scan list (we still process their children naturally)
  const linearSelector = [
    "h1,h2,h3,h4,h5,h6",
    "p,div,a,img,button,ul,ol,li",
    "aside,main,footer,figure", // (SECTION, HEADER intentionally omitted)
  ].join(",");

  const nodes = [...document.body.querySelectorAll(linearSelector)]
    .filter((el) => !processedNodes.has(el))
    .filter(isVisible);

  /**
    Render the HTML tree structure into the given panel.
     */
  const renderHTMLTree = (panel) => {
    let lastHeadingLevel = 0;
    let lastKey = "";
    const addOnce = (badge, main, sub, indent, el, key) => {
      if (key && key === lastKey) return;
      panel.appendChild(createItem(badge, main, sub, indent, el));
      if (key) lastKey = key;
    };

    for (const el of nodes) {
      const tag = el.tagName.toUpperCase();

      // Headings drive indentation
      if (tag.startsWith("H")) {
        lastHeadingLevel = Number(tag.slice(1));
        const indent = (lastHeadingLevel - 1) * INDENT_UNIT;
        const text = (el.textContent || "").trim() || "(empty)";
        addOnce(tag, text, "", indent, el, tag + "::" + normalize(text));
        continue;
      }
      const indent = (lastHeadingLevel || 0) * INDENT_UNIT;

      // Paragraphs
      if (tag === "P") {
        const text = (el.textContent || "").trim() || "(empty)";
        addOnce("P", text, "", indent, el, "P::" + normalize(text));
        continue;
      }

      // Lists
      if (tag === "UL" || tag === "OL") {
        const visLIs = [...el.querySelectorAll(":scope > li")].filter(
          isVisible
        );

        // (2) If exactly one LI: skip the UL/OL row entirely (let child render)
        if (visLIs.length === 1) {
          continue; // do not add UL/OL row
        }

        // Otherwise, you may show list's own text (rare) and let each LI render itself
        const listTitle = ownText(el);
        if (listTitle)
          addOnce(
            tag,
            listTitle,
            "",
            indent,
            el,
            tag + "::" + normalize(listTitle)
          );
        continue; // LIs render below in their own pass
      }

      // LI rows
      if (tag === "LI") {
        // (3) UL > LI > A: prefer the anchor(s) as the item(s)
        const directAs = [...el.querySelectorAll(":scope > a")].filter(
          isVisible
        );
        if (directAs.length >= 1) {
          for (const a of directAs) {
            // Anchor as a container: free text + href
            const linkText = collectFreeText(a) || ""; // in list case, usually the link's label
            const href = a.getAttribute("href")?.trim() || "empty link";
            if (linkText) {
              addOnce(
                "A",
                linkText,
                href,
                indent,
                a,
                "A::" + normalize(linkText) + "::" + href
              );
            }
          }
          continue; // don't add LI row when anchors are used
        }

        // Otherwise, normal LI text
        const text = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (text) addOnce("LI", text, "", indent, el, "LI::" + normalize(text));
        continue;
      }

      // Buttons own their text
      if (tag === "BUTTON") {
        const text = (el.textContent || "").trim() || "(empty)";
        addOnce("BTN", text, "", indent, el, "BUTTON::" + normalize(text));
        continue;
      }

      // Images always visible as items
      if (tag === "IMG") {
        const alt = el.getAttribute("alt")?.trim() || "empty alt text";
        const src = el.getAttribute("src")?.trim() || "empty url";
        addOnce(
          "IMG",
          alt,
          src,
          indent,
          el,
          "IMG::" + normalize(alt) + "::" + src
        );
        continue;
      }

      // ---------- Generalized container behavior ----------
      const isContainer = el.matches(CONTAINER_SELECTOR);

      // DIV-special rules: skip inner divs in div>div chain; skip divs inside non-div owners
      if (tag === "DIV") {
        const nonDivOwner = el.closest(NON_DIV_OWNERS);
        if (nonDivOwner && nonDivOwner !== el) continue;
        const parentDiv = el.parentElement?.closest("div");
        if (parentDiv && parentDiv !== el) continue; // inner div; let outermost div handle
      }

      if (isContainer) {
        const freeText = collectFreeText(el);
        if (!freeText) continue;

        const badge =
          tag === "A"
            ? "A"
            : ["ARTICLE", "ASIDE", "MAIN", "FOOTER", "FIGURE"].includes(tag)
            ? tag
            : tag === "DIV"
            ? "DIV"
            : tag;

        const sub =
          tag === "A" ? el.getAttribute("href")?.trim() || "empty link" : "";

        addOnce(
          badge,
          freeText,
          sub,
          indent,
          el,
          badge + "::" + normalize(freeText) + (sub ? "::" + sub : "")
        );
        continue;
      }

      // Fallback: ignore
    }
  };

  const renderEmptyLinks = (panel) => {
    const links = [];
    document.querySelectorAll("a").forEach((a) => {
      if (!isVisible(a)) return;
      const href = (a.getAttribute("href") || "").trim();
      if (!href || href === "#")
        links.push({ text: collectFreeText(a) || "(no text)", href });
    });

    if (links.length === 0) {
      const msg = document.createElement("div");
      msg.textContent = "No empty href links found.";
      panel.appendChild(msg);
      return;
    }

    for (const link of links) {
      const item = createItem("A", link.text, link.href, 0, link.el);
      panel.appendChild(item);
    }
  };

  const renderEmptyAltImgs = (panel) => {
    const imgs = [];
    document.querySelectorAll("img").forEach((img) => {
      if (!isVisible(img)) return;
      const alt = (img.getAttribute("alt") || "").trim();
      if (!alt)
        imgs.push({ src: img.getAttribute("src") || "empty url", el: img });
    });

    if (imgs.length === 0) {
      const msg = document.createElement("div");
      msg.textContent = "No images with empty alt found.";
      panel.appendChild(msg);
      return;
    }

    for (const img of imgs) {
      const item = createItem("IMG", "empty alt text", img.src, 0, img.el);
      panel.appendChild(item);
    }
  };

  /** -----------------------------------------------------
   * STATS
   * ----------------------------------------------------- */

  const makeStat = (label, value) => {
    const cell = document.createElement("div");
    cell.className = "hp-stat";
    cell.innerHTML = `<div class="hp-stat-label">${label}</div><div class="hp-stat-value">${value}</div>`;
    return cell;
  };

  const renderStats = (panel) => {
    const headingGrid = document.createElement("div");
    headingGrid.className = "hp-stat-grid";

    const headingCounts = {};
    document.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach((h) => {
      if (isVisible(h))
        headingCounts[h.tagName] = (headingCounts[h.tagName] || 0) + 1;
    });

    ["H1", "H2", "H3", "H4", "H5", "H6"].forEach((h) =>
      headingGrid.appendChild(makeStat(h, headingCounts[h] || 0))
    );

    const tagGrid = document.createElement("div");
    tagGrid.className = "hp-stat-grid";

    const aStats = { total: 0, missingHref: 0 };
    document.querySelectorAll("a").forEach((a) => {
      aStats.total++;
      const href = (a.getAttribute("href") || "").trim();
      if (!href || href === "#") aStats.missingHref++;
    });

    const imgStats = { total: 0, missingAlt: 0, missingTitle: 0 };
    document.querySelectorAll("img").forEach((img) => {
      imgStats.total++;
      const alt = (img.getAttribute("alt") || "").trim();
      const title = (img.getAttribute("title") || "").trim();
      if (!title) imgStats.missingTitle++;
      if (!alt) imgStats.missingAlt++;
    });

    tagGrid.append(
      makeStat("A total", aStats.total),
      makeStat("A missing href", aStats.missingHref),
      makeStat("IMG total", imgStats.total),
      makeStat("IMG missing alt", imgStats.missingAlt),
      makeStat("IMG missing title", imgStats.missingTitle)
    );

    panel.append(headingGrid, tagGrid);
  };

  /** -----------------------------------------------------
   * TAB SYSTEM
   * ----------------------------------------------------- */
  const makeTabs = (panel, tabs) => {
    const tabHeader = document.createElement("div");
    tabHeader.className = "hp-tab-header";
    const tabBodies = {};
    const contentContainer = document.createElement("div");
    contentContainer.className = "hp-content";

    for (const [id, label, builder] of tabs) {
      const btn = document.createElement("div");
      btn.className = "hp-tab";
      btn.textContent = label;
      tabHeader.appendChild(btn);

      const body = document.createElement("div");
      body.style.display = "none";
      contentContainer.appendChild(body);
      tabBodies[id] = { btn, body, builder };

      btn.addEventListener("click", () => {
        for (const t of Object.values(tabBodies)) {
          t.body.style.display = "none";
          t.btn.classList.remove("active");
        }
        body.style.display = "block";
        btn.classList.add("active");
        if (!body.hasChildNodes()) builder(body);
      });
    }

    panel.append(tabHeader, contentContainer);
    tabBodies[Object.keys(tabBodies)[0]].btn.click(); // activate first tab
  };

  /** -----------------------------------------------------
   * MAIN EXECUTION
   * ----------------------------------------------------- */
  const existing = document.getElementById(PANEL_ID);
  if (existing) {
    existing.remove();
    if (typeof existing.__teardown === "function") existing.__teardown();
    return;
  }

  const { panel, closeBtn } = createPanel();
  document.body.appendChild(panel);

  // Render structure and stats
  // renderHTMLTree(panel);
  // renderStats(panel);

  makeTabs(panel, [
    ["tree", "HTML Tree", (b) => renderHTMLTree(b)],
    ["href", "Missing href", (b) => renderEmptyLinks(b)],
    ["alt", "Missing alt img", (b) => renderEmptyAltImgs(b)],
    ["stats", "Stats", (b) => renderStats(b)],
  ]);

  // Handle toggles
  panel.querySelectorAll("input[data-toggle]").forEach((input) =>
    input.addEventListener("change", (e) => {
      const { checked } = e.target;
      const type = e.target.dataset.toggle;
      if (checked) {
        if (type === "headings") highlightHeadings();
        else if (type === "a") highlightEmptyLinks();
        else if (type === "img") highlightEmptyAltImgs();
      } else {
        removeHighlights();
      }
    })
  );

  /** -----------------------------------------------------
   * CLOSE / TEARDOWN
   * ----------------------------------------------------- */
  const closePanel = () => {
    removeHighlights();
    panel.remove();
    document.removeEventListener("pointerdown", outsideClick, true);
    window.removeEventListener("keydown", onKeydown, true);
  };

  const outsideClick = (e) => {
    if (!panel.contains(e.target)) closePanel();
  };
  const onKeydown = (e) => e.key === "Escape" && closePanel();

  panel.addEventListener("pointerdown", (e) => e.stopPropagation(), true);
  document.addEventListener("pointerdown", outsideClick, true);
  window.addEventListener("keydown", onKeydown, true);
  closeBtn.addEventListener("click", closePanel);

  panel.__teardown = closePanel;
})();
