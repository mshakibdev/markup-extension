(() => {
    const PANEL_ID = "__content_panel__";
    const INDENT_UNIT = 32;

    // Toggle
    const existing = document.getElementById(PANEL_ID);
    if (existing) {
        existing.remove();
        if (typeof existing.__teardown === "function") existing.__teardown();
        return;
    }

    // ---------- Highlight overlay ----------
    function highlightOverlayFollow(el, durationMs = 1500) {
        const ID = "__hp_highlight_box__";
        document.getElementById(ID)?.remove();
        const box = document.createElement("div");
        Object.assign(box.style, {
            position: "fixed",
            border: "2px dashed #3b82f6",
            borderRadius: "4px",
            pointerEvents: "none",
            zIndex: "2147483647",
            boxSizing: "border-box"
        });
        box.id = ID;
        document.body.appendChild(box);

        let running = true;
        const update = () => {
            if (!running || !el.isConnected) return;
            const r = el.getBoundingClientRect();
            box.style.left = r.left + "px";
            box.style.top = r.top + "px";
            box.style.width = r.width + "px";
            box.style.height = r.height + "px";
            requestAnimationFrame(update);
        };
        const onScroll = () => running && update();
        const onResize = () => running && update();
        window.addEventListener("scroll", onScroll, true);
        window.addEventListener("resize", onResize, true);
        requestAnimationFrame(update);
        setTimeout(() => {
            running = false;
            window.removeEventListener("scroll", onScroll, true);
            window.removeEventListener("resize", onResize, true);
            box.remove();
        }, durationMs);
    }

    // ---------- Helpers ----------
    const isVisible = (el) => {
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") return false;
        if (!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)) return false;
        if (el.closest("template,[aria-hidden='true']")) return false;
        return true;
    };
    const ownText = (el) => {
        let out = "";
        for (const n of el.childNodes) if (n.nodeType === Node.TEXT_NODE) out += n.textContent;
        return out.trim().replace(/\s+/g, " ");
    };
    const normalize = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();

    // Semantic owners (containers shouldn't steal from these)
    const SEMANTIC_OWNER_SELECTOR = [
        "h1","h2","h3","h4","h5","h6",
        "p","ul","ol","li",
        "button","a","label","summary","figcaption",
        "th","td","dt","dd",
        "[role='button']","[role='link']",
        "figure","section","article","aside","main","header","footer","nav"
    ].join(",");

    // Containers that should collect only free text
    // (SECTION/HEADER deliberately NOT included here per your rule to skip them)
    const CONTAINER_SELECTOR = [
        "a","aside","main","footer","figure","div"
    ].join(",");

    // Free-text collector: accept only text inside rootEl that isn't owned by a semantic child inside rootEl
    function collectFreeText(rootEl) {
        const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, {
            acceptNode: (node) => {
                const text = node.nodeValue.replace(/\s+/g, " ").trim();
                if (!text) return NodeFilter.FILTER_REJECT;
                const parentEl = node.parentElement;
                if (!parentEl) return NodeFilter.FILTER_REJECT;
                if (!isVisible(parentEl)) return NodeFilter.FILTER_REJECT;
                if (parentEl.closest("script,style,svg")) return NodeFilter.FILTER_REJECT;

                // Only reject if the owner is INSIDE rootEl (outside owners like <header> shouldn't block)
                const owner = parentEl.closest(SEMANTIC_OWNER_SELECTOR);
                if (owner && owner !== rootEl && rootEl.contains(owner)) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        let chunks = [];
        let n;
        while ((n = walker.nextNode())) chunks.push(n.nodeValue);
        return chunks.join(" ").replace(/\s+/g, " ").trim();
    }

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
            const target = targetEl;
            try {
                target.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
            } catch {
                target.scrollIntoView(true);
            }
            const hadTabIndex = target.hasAttribute("tabindex");
            if (!hadTabIndex) target.setAttribute("tabindex", "-1");
            let frames = 0;
            const afterScroll = () => {
                frames++;
                if (frames < 2) return requestAnimationFrame(afterScroll);
                target.focus({ preventScroll: true });
                highlightOverlayFollow(target, 1500);
                if (!hadTabIndex) target.removeAttribute("tabindex");
            };
            requestAnimationFrame(afterScroll);
        });

        return item;
    };

    // ---------- Panel scaffold ----------
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

    // Skip whole nav (and descendants)
    const processedNodes = new Set();
    document.body.querySelectorAll("nav, [role='navigation'], .navbar, .mobile-navbar")
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
        "aside,main,footer,figure" // (SECTION, HEADER intentionally omitted)
    ].join(",");

    const nodes = [...document.body.querySelectorAll(linearSelector)]
        .filter((el) => !processedNodes.has(el))
        .filter(isVisible);

    const headingCounts = { H1:0,H2:0,H3:0,H4:0,H5:0,H6:0 };
    document.body.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach(h=>{
        if (isVisible(h) && !processedNodes.has(h)) headingCounts[h.tagName]++;
    });

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
            const visLIs = [...el.querySelectorAll(":scope > li")].filter(isVisible);

            // (2) If exactly one LI: skip the UL/OL row entirely (let child render)
            if (visLIs.length === 1) {
                continue; // do not add UL/OL row
            }

            // Otherwise, you may show list's own text (rare) and let each LI render itself
            const listTitle = ownText(el);
            if (listTitle) addOnce(tag, listTitle, "", indent, el, tag + "::" + normalize(listTitle));
            continue; // LIs render below in their own pass
        }

        // LI rows
        if (tag === "LI") {
            // (3) UL > LI > A: prefer the anchor(s) as the item(s)
            const directAs = [...el.querySelectorAll(":scope > a")].filter(isVisible);
            if (directAs.length >= 1) {
                for (const a of directAs) {
                    // Anchor as a container: free text + href
                    const linkText = collectFreeText(a) || ""; // in list case, usually the link's label
                    const href = a.getAttribute("href")?.trim() || "empty link";
                    if (linkText) {
                        addOnce("A", linkText, href, indent, a, "A::" + normalize(linkText) + "::" + href);
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
            addOnce("IMG", alt, src, indent, el, "IMG::" + normalize(alt) + "::" + src);
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
                tag === "A" ? "A" :
                    ["ARTICLE","ASIDE","MAIN","FOOTER","FIGURE"].includes(tag) ? tag :
                        tag === "DIV" ? "DIV" : tag;

            const sub =
                tag === "A" ? (el.getAttribute("href")?.trim() || "empty link") : "";

            addOnce(badge, freeText, sub, indent, el, badge + "::" + normalize(freeText) + (sub ? "::" + sub : ""));
            continue;
        }

        // Fallback: ignore
    }

    // ---------- Footer stats ----------
    const stats = document.createElement("div");
    stats.className = "hp-stats";
    const grid = document.createElement("div");
    grid.className = "hp-stat-grid";
    const makeStat = (label, value) => {
        const cell = document.createElement("div");
        cell.className = "hp-stat";
        const lab = document.createElement("div"); lab.className = "hp-stat-label"; lab.textContent = label;
        const val = document.createElement("div"); val.className = "hp-stat-value"; val.textContent = String(value);
        cell.appendChild(lab); cell.appendChild(val); return cell;
    };
    ["H1","H2","H3","H4","H5","H6"].forEach(h => grid.appendChild(makeStat(h, headingCounts[h] || 0)));
    stats.appendChild(grid);
    panel.appendChild(stats);

    document.body.appendChild(panel);

    // ---------- Close / teardown ----------
    const closePanel = () => {
        panel.remove();
        document.removeEventListener("pointerdown", outsideClick, true);
        window.removeEventListener("keydown", onKeydown, true);
    };
    const outsideClick = (e) => { if (!panel.contains(e.target)) closePanel(); };
    const onKeydown = (e) => { if (e.key === "Escape") closePanel(); };

    panel.addEventListener("pointerdown", (e) => e.stopPropagation(), true);
    document.addEventListener("pointerdown", outsideClick, true);
    window.addEventListener("keydown", onKeydown, true);
    closeBtn.addEventListener("click", closePanel);

    panel.__teardown = closePanel;
})();
