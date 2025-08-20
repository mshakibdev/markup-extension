(() => {
    const PANEL_ID = "__content_panel__";
    const INDENT_UNIT = 32; // px per heading level

    // Toggle panel
    const existing = document.getElementById(PANEL_ID);
    if (existing) {
        existing.remove();
        if (typeof existing.__teardown === "function") existing.__teardown();
        return;
    }

    // ---------- Helpers ----------
    const isVisible = (el) => {
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") return false;
        if (!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)) return false;
        if (el.closest("template,[aria-hidden='true']")) return false;
        return true;
    };

    // DIV: own text only (avoid repeating child text)
    const ownText = (el) => {
        let out = "";
        for (const n of el.childNodes) {
            if (n.nodeType === Node.TEXT_NODE) out += n.textContent;
        }
        return out.trim().replace(/\s+/g, " ");
    };

    // UI row
    const createItem = (badgeText, mainText, subText, indentPx, targetEl) => {
        const item = document.createElement("div");
        item.className = "hp-item";
        item.style.marginLeft = indentPx + "px";

        const badge = document.createElement("span");
        badge.className = "hp-badge";
        badge.textContent = badgeText;

        const textWrap = document.createElement("div");
        textWrap.className = "hp-textwrap";

        const main = document.createElement("div");
        main.className = "hp-text";
        main.textContent = mainText;

        textWrap.appendChild(main);
        if (subText) {
            const sub = document.createElement("div");
            sub.className = "hp-subtext";
            sub.textContent = subText;
            textWrap.appendChild(sub);
        }

        item.appendChild(badge);
        item.appendChild(textWrap);

        item.addEventListener("click", () => {
            targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
            const oldOutline = targetEl.style.outline;
            targetEl.style.outline = "2px dashed #3b82f6";
            setTimeout(() => (targetEl.style.outline = oldOutline), 1200);
        });

        return item;
    };

    // ---------- Panel skeleton ----------
    const panel = document.createElement("div");
    panel.id = PANEL_ID;

    const header = document.createElement("div");
    header.className = "hp-header";
    const title = document.createElement("div");
    title.className = "hp-title";
    title.textContent = "HTML TREE";
    const closeBtn = document.createElement("button");
    closeBtn.className = "hp-close";
    closeBtn.type = "button";
    closeBtn.textContent = "×";
    header.appendChild(title);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // ---------- Skip all <nav> and nav-like blocks ----------
    const navSelector = "nav, [role='navigation'], .navbar, .mobile-navbar";
    const navBlocks = [...document.body.querySelectorAll(navSelector)];

    // Mark navs and ALL their descendants as processed so they never appear
    const processedNodes = new Set();
    navBlocks.forEach((nav) => {
        processedNodes.add(nav);
        nav.querySelectorAll("*").forEach((el) => processedNodes.add(el));
    });

    // ---------- Collect linear nodes outside nav ----------
    const linearSelector = "h1,h2,h3,h4,h5,h6,p,div,a,img";
    const linearNodes = [...document.body.querySelectorAll(linearSelector)]
        .filter((el) => !processedNodes.has(el)) // skip nav and its children
        .filter(isVisible);

    if (!linearNodes.length) {
        // still show a panel (useful to verify nav skip)
        panel.appendChild(createItem("INFO", "No supported elements found outside <nav>.", "", 0, document.body));
    }

    // Heading counts (footer) – also skip hidden
    const headingCounts = { H1: 0, H2: 0, H3: 0, H4: 0, H5: 0, H6: 0 };
    document.body.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach((h) => {
        if (isVisible(h) && !processedNodes.has(h)) {
            headingCounts[h.tagName.toUpperCase()]++;
        }
    });

    // ---------- Render linear stream with heading-based indentation ----------
    let lastHeadingLevel = 0;

    const normalize = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();
    let lastKey = "";

    linearNodes.forEach((el) => {
        const tag = el.tagName.toUpperCase();
        let indent = 0;

        if (tag.startsWith("H")) {
            lastHeadingLevel = Number(tag.slice(1));
            indent = (lastHeadingLevel - 1) * INDENT_UNIT;

            const text = (el.textContent || "").trim() || "(empty)";
            const key = "H" + lastHeadingLevel + "::" + normalize(text);
            if (key !== lastKey) {
                panel.appendChild(createItem(tag, text, "", indent, el));
                lastKey = key;
            }
            return;
        }

        // Non-headings nest under the last seen heading level
        indent = (lastHeadingLevel ? lastHeadingLevel : 0) * INDENT_UNIT;

        if (tag === "P") {
            const text = (el.textContent || "").trim() || "(empty)";
            const key = "P::" + normalize(text);
            if (key !== lastKey) {
                panel.appendChild(createItem("P", text, "", indent, el));
                lastKey = key;
            }
            return;
        }

        if (tag === "DIV") {
            // Only own text; ignore divs that contain style/script
            if (el.querySelector("style,script")) return;
            const text = ownText(el);
            if (!text) return;
            const key = "DIV::" + normalize(text);
            if (key !== lastKey) {
                panel.appendChild(createItem("DIV", text, "", indent, el));
                lastKey = key;
            }
            return;
        }

        if (tag === "A") {
            const linkText = (el.textContent || "").trim() || "empty text";
            const href = el.getAttribute("href")?.trim() || "empty link";
            const key = "A::" + normalize(linkText) + "::" + href;
            if (key !== lastKey) {
                panel.appendChild(createItem("A", linkText, href, indent, el));
                lastKey = key;
            }
            return;
        }

        if (tag === "IMG") {
            const alt = el.getAttribute("alt")?.trim() || "empty alt text";
            const src = el.getAttribute("src")?.trim() || "empty url";
            const key = "IMG::" + normalize(alt) + "::" + src;
            if (key !== lastKey) {
                panel.appendChild(createItem("IMG", alt, src, indent, el));
                lastKey = key;
            }
            return;
        }
    });

    // ---------- Footer stats (H1–H6 only) ----------
    const stats = document.createElement("div");
    stats.className = "hp-stats";
    const grid = document.createElement("div");
    grid.className = "hp-stat-grid";

    const makeStat = (label, value) => {
        const cell = document.createElement("div");
        cell.className = "hp-stat";
        const lab = document.createElement("div");
        lab.className = "hp-stat-label";
        lab.textContent = label;
        const val = document.createElement("div");
        val.className = "hp-stat-value";
        val.textContent = String(value);
        cell.appendChild(lab);
        cell.appendChild(val);
        return cell;
    };

    ["H1", "H2", "H3", "H4", "H5", "H6"].forEach((h) =>
        grid.appendChild(makeStat(h, headingCounts[h] || 0))
    );

    stats.appendChild(grid);
    panel.appendChild(stats);

    document.body.appendChild(panel);

    // ---------- Close / teardown ----------
    const closePanel = () => {
        panel.remove();
        document.removeEventListener("pointerdown", outsideClick, true);
        window.removeEventListener("keydown", onKeydown, true);
    };
    const outsideClick = (e) => {
        if (!panel.contains(e.target)) closePanel();
    };
    const onKeydown = (e) => {
        if (e.key === "Escape") closePanel();
    };

    panel.addEventListener("pointerdown", (e) => e.stopPropagation(), true);
    document.addEventListener("pointerdown", outsideClick, true);
    window.addEventListener("keydown", onKeydown, true);
    closeBtn.addEventListener("click", closePanel);

    panel.__teardown = closePanel;
})();
