function downloadJSAtOnload() {
    var element = document.createElement("script");
    element.src = "https://torcommunity.com/db/tooltip.js?v=" + new Date().getTime();
    document.body.appendChild(element);
}
if (window.addEventListener)
    window.addEventListener("load", downloadJSAtOnload, false);
else if (window.attachEvent)
    window.attachEvent("onload", downloadJSAtOnload);
else window.onload = downloadJSAtOnload;