// Applies the visitor's chosen look before first paint, so a saved style never
// flashes the classic one. Self-hosted because the CSP allows no inline script.
// The default (nothing saved) is the classic light site; see src/lib/siteStyle.ts.
(function () {
  try {
    var s = localStorage.getItem("lalum-style");
    if (s === "sovereign" || s === "sage") {
      document.documentElement.setAttribute("data-style", s);
      var m = document.querySelector('meta[name="theme-color"]');
      if (m) m.setAttribute("content", s === "sage" ? "#14161b" : "#07080B");
    }
  } catch (e) { /* storage blocked: stay classic */ }
})();
