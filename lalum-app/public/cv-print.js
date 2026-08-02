// Same-origin script so the print action needs no inline handler, keeping the
// page compatible with a strict Content-Security-Policy (script-src 'self').
document.addEventListener("DOMContentLoaded", function () {
  var link = document.getElementById("cv-print");
  if (!link) return;
  link.addEventListener("click", function (e) {
    e.preventDefault();
    window.print();
  });
});
