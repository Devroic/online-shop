// Runs before the app so a returning visitor in dark mode doesn't see a white flash.
try {
  var a = localStorage.getItem('shop.appearance');
  if (a === 'dark' || a === 'light') document.documentElement.dataset.theme = a;
} catch (e) {}
