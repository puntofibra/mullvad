/* Service worker de la PWA Mullvad - permite instalarla y abrirla sin cobertura.
 *
 * Regla: el contenido se pide SIEMPRE a la red y la cache es solo el respaldo
 * para cuando no hay conexion. Asi una version nueva entra sola, sin tener que
 * borrar datos del navegador. (Antes era al reves y la app se quedaba clavada
 * en la version vieja.)
 *
 * Solo toca URLs de /mullvad/ y solo borra caches suyas, para no pisar al resto
 * de aplicaciones que viven en el mismo dominio.
 */
var CACHE = 'pf-mullvad-v1';
var ANTIGUAS = ['mullvad-v1'];
var ESENCIALES = ['./', './index.html'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(ESENCIALES);
    }).catch(function () {})
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (nombres) {
      return Promise.all(nombres
        .filter(function (n) {
          if (n === CACHE) return false;
          return n.indexOf('pf-mullvad-') === 0 || ANTIGUAS.indexOf(n) >= 0;
        })
        .map(function (n) { return caches.delete(n); }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (err) { return; }

  // Apps Script y demas: siempre a la red, sin cachear
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf('/mullvad/') !== 0) return;

  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.status === 200) {
        var copia = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copia); }).catch(function () {});
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) {
        return hit || caches.match('./index.html') || caches.match('./');
      });
    })
  );
});
