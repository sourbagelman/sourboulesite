// Google Analytics (GA4)
(function () {
  const GA_ID = "G-Y9L47GTRMD";

  const script = document.createElement("script");
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  script.async = true;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  window.gtag = gtag;

  gtag('js', new Date());
  gtag('config', GA_ID);
})();

// Favicon
(function () {
  const faviconHref = "images/favicon-32.png";

  let favicon = document.querySelector("link[rel='icon']");
  if (!favicon) {
    favicon = document.createElement("link");
    favicon.rel = "icon";
    document.head.appendChild(favicon);
  }

  favicon.type = "image/png";
  favicon.href = faviconHref;
})();

// Track Order Now clicks
document.addEventListener("click", function(e) {
  const target = e.target.closest("a");

  if (!target) return;

  if (
    target.href &&
    (
      target.href.includes("squareup.com") ||
      [
        "https://cash.app/$thesourboule/l/CALL_CAESDUwxS0FDNkRTS1NROU0/pickup",
        "https://cash.app/$thesourboule/l/CALL_CAESDUxaVlhKOFBKRjI0MkM/pickup"
      ].includes(target.href)
    )
  ) {
    if (window.gtag) {
      gtag("event", "order_click", {
        event_category: "engagement",
        event_label: target.href
      });
    }
  }
});
