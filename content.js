(() => {
    const PANEL_ID = "__headings_panel__";
    let teardown = null; // cleanup function

    // Toggle: remove if already open
    const existing = document.getElementById(PANEL_ID);
    if (existing) {
        existing.remove();
        // run previous teardown if any
        if (typeof existing.__teardown === "function") existing.__teardown();
        return;
    }

    const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")];
    if (!headings.length) {
        alert("No H1–H6 elements found on this page.");
        return;
    }

    const panel = document.createElement("div");
    panel.id = PANEL_ID;

    // Header
    const header = document.createElement("div");
    header.className = "hp-header";
    const title = document.createElement("div");
    title.className = "hp-title";
    title.textContent = "Headings";
    const closeBtn = document.createElement("button");
    closeBtn.className = "hp-close";
    closeBtn.type = "button";
    closeBtn.textContent = "×";
    header.appendChild(title);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // List items
    headings.forEach((el) => {
        const level = Number(el.tagName.slice(1));
        const item = document.createElement("div");
        item.className = "hp-item";
        item.style.marginLeft = (level - 1) * 16 + "px";

        const badge = document.createElement("span");
        badge.className = "hp-badge";
        badge.textContent = `H${level}`;

        const text = document.createElement("span");
        text.className = "hp-text";
        text.textContent = (el.textContent || "").trim() || "(empty)";

        item.addEventListener("click", () => {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            const oldOutline = el.style.outline;
            el.style.outline = "2px dashed #3b82f6";
            setTimeout(() => (el.style.outline = oldOutline), 1200);
        });

        item.appendChild(badge);
        item.appendChild(text);
        panel.appendChild(item);
    });

    document.body.appendChild(panel);

    // ---------- Close / teardown logic ----------
    const closePanel = () => {
        panel.remove();
        // remove listeners
        document.removeEventListener("pointerdown", outsideClick, true);
        window.removeEventListener("keydown", onKeydown, true);
    };

    const outsideClick = (e) => {
        // if click target is NOT inside the panel, close
        if (!panel.contains(e.target)) {
            closePanel();
        }
    };

    const onKeydown = (e) => {
        if (e.key === "Escape") closePanel();
    };

    // prevent outside-click close when clicking inside panel
    panel.addEventListener("pointerdown", (e) => e.stopPropagation(), true);

    // listeners in capture phase to catch early
    document.addEventListener("pointerdown", outsideClick, true);
    window.addEventListener("keydown", onKeydown, true);

    closeBtn.addEventListener("click", closePanel);

    // expose teardown so if user re-injects we can clean
    panel.__teardown = closePanel;
})();
