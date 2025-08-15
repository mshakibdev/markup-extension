(() => {
    const PANEL_ID = "__content_panel__";

    // If panel exists, remove it
    const existing = document.getElementById(PANEL_ID);
    if (existing) {
        existing.remove();
        if (typeof existing.__teardown === "function") existing.__teardown();
        return;
    }

    // Select headings and paragraphs in order
    const elements = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6,p")];
    if (!elements.length) {
        alert("No headings or paragraphs found.");
        return;
    }

    // Create panel
    const panel = document.createElement("div");
    panel.id = PANEL_ID;

    // Header
    const header = document.createElement("div");
    header.className = "hp-header";
    const title = document.createElement("div");
    title.className = "hp-title";
    title.textContent = "Headings & Paragraphs";
    const closeBtn = document.createElement("button");
    closeBtn.className = "hp-close";
    closeBtn.type = "button";
    closeBtn.textContent = "×";
    header.appendChild(title);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Items
    elements.forEach((el) => {
        const tag = el.tagName.toUpperCase();
        const item = document.createElement("div");
        item.className = "hp-item";

        // Indent based on heading level (P has no indent)
        if (tag.startsWith("H")) {
            const level = Number(tag.slice(1));
            item.style.marginLeft = (level - 1) * 16 + "px";
        }

        const badge = document.createElement("span");
        badge.className = "hp-badge";
        badge.textContent = tag;

        const text = document.createElement("span");
        text.className = "hp-text";
        text.textContent = (el.textContent || "").trim() || "(empty)";

        // Click action
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

    // Close logic
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
