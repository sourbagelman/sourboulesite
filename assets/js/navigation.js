document.addEventListener("DOMContentLoaded", function () {
  const mobileNav = document.querySelector(".mobile-nav");
  const disclosureMenus = Array.from(document.querySelectorAll(".site-nav details, .mobile-nav"));

  if (mobileNav) {
    const mobileSummary = mobileNav.querySelector("summary");
    const syncMobileState = function () {
      mobileSummary.setAttribute("aria-expanded", String(mobileNav.open));
      mobileSummary.setAttribute("aria-label", mobileNav.open ? "Close navigation menu" : "Open navigation menu");
    };

    mobileNav.addEventListener("toggle", syncMobileState);
    syncMobileState();
  }

  disclosureMenus.forEach(function (menu) {
    menu.addEventListener("toggle", function () {
      if (!menu.open) return;

      disclosureMenus.forEach(function (otherMenu) {
        if (otherMenu !== menu) otherMenu.open = false;
      });
    });
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;

    const openMenu = document.querySelector(".site-nav details[open], .mobile-nav[open]");
    if (!openMenu) return;

    const summary = openMenu.querySelector("summary");
    openMenu.open = false;
    if (openMenu.classList.contains("mobile-nav")) {
      summary?.setAttribute("aria-expanded", "false");
      summary?.setAttribute("aria-label", "Open navigation menu");
    }
    summary?.focus();
  });
});
