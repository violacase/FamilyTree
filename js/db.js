// IndexedDB persistence layer
// Stores: "trees" (keyPath: id), "settings" (key/value: activeId, nid)

var _db = null;

function openDB() {
  return new Promise(function(resolve, reject) {
    var req = indexedDB.open('FamilyChronicle', 1);
    req.onupgradeneeded = function(e) {
      var d = e.target.result;
      if (!d.objectStoreNames.contains('trees'))
        d.createObjectStore('trees', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('settings'))
        d.createObjectStore('settings');
    };
    req.onsuccess = function(e) { _db = e.target.result; resolve(); };
    req.onerror   = function(e) { reject(e.target.error); };
  });
}

function dbPut(store, value, key) {
  return new Promise(function(resolve, reject) {
    var tx  = _db.transaction(store, 'readwrite');
    var req = (key !== undefined) ? tx.objectStore(store).put(value, key)
                                  : tx.objectStore(store).put(value);
    tx.oncomplete = resolve;
    tx.onerror    = function(e) { reject(e.target.error); };
  });
}

function dbDelete(store, key) {
  return new Promise(function(resolve, reject) {
    var tx = _db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = resolve;
    tx.onerror    = function(e) { reject(e.target.error); };
  });
}

function dbGetAll(store) {
  return new Promise(function(resolve, reject) {
    var tx  = _db.transaction(store, 'readonly');
    var req = tx.objectStore(store).getAll();
    req.onsuccess = function(e) { resolve(e.target.result); };
    req.onerror   = function(e) { reject(e.target.error); };
  });
}

function dbGet(store, key) {
  return new Promise(function(resolve, reject) {
    var tx  = _db.transaction(store, 'readonly');
    var req = tx.objectStore(store).get(key);
    req.onsuccess = function(e) { resolve(e.target.result); };
    req.onerror   = function(e) { reject(e.target.error); };
  });
}

async function loadAll() {
  var trees = await dbGetAll('trees');
  st.trees  = {};
  trees.forEach(function(t){ st.trees[t.id] = t; });

  var max = 0;
  trees.forEach(function(t){
    Object.keys(t.persons || {}).forEach(function(id){
      var n = parseInt(id.slice(1)); if (n > max) max = n;
    });
    var tn = parseInt(t.id.slice(1)); if (tn > max) max = tn;
  });
  var storedNid = await dbGet('settings', 'nid');
  nid = Math.max(max + 1, storedNid || 1);

  var aid = await dbGet('settings', 'activeId');
  st.activeId = (aid && st.trees[aid]) ? aid : (Object.keys(st.trees)[0] || null);
}

async function save() {
  var tree = activeTree();
  if (tree) await dbPut('trees', tree);
  await dbPut('settings', st.activeId, 'activeId');
  await dbPut('settings', nid,         'nid');
  showSaved();
}

function showSaved() {
  var el = document.getElementById('savedBadge');
  el.classList.add('on');
  clearTimeout(el._t);
  el._t = setTimeout(function(){ el.classList.remove('on'); }, 1800);
}

function setDBStatus(ok, text) {
  document.getElementById('dbDot').className    = 'db-dot ' + (ok ? 'ok' : 'err');
  document.getElementById('dbLabel').textContent = text;
}
