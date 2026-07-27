// Activate the Google Fonts stylesheet without an inline onload handler, so a
// strict Content-Security-Policy (script-src 'self') never blocks it. The
// stylesheet is fetched with media="print" so it does not block first paint;
// this self-hosted script flips it to all once the document is parsed. The app
// always opens on system fonts and swaps the web fonts in when they arrive.
(function () {
  var link = document.getElementById("gfonts-css");
  if (link) link.media = "all";
})();
