// App state, tree & person management, UI, pan/zoom, init

var st    = { trees: {}, activeId: null };
var nid   = 1;
var selId = null, ctxId = null;
var _confirmCb = null;

function gid() { return 'p' + (nid++); }
function activeTree() { return st.activeId ? st.trees[st.activeId] : null; }


// ── TREE MANAGEMENT ──────────────────────────────────────────

function newTree() {
  var inp = document.getElementById('newTreeInp');
  inp.value = 'Family Tree ' + (Object.keys(st.trees).length + 1);
  document.getElementById('newTreeOvl').classList.add('on');
  setTimeout(function(){ inp.select(); inp.focus(); }, 80);
}

async function confirmNewTree() {
  var name = document.getElementById('newTreeInp').value.trim();
  if (!name) { document.getElementById('newTreeInp').focus(); return; }
  var id = gid();
  st.trees[id] = { id: id, name: name, persons: {} };
  st.activeId  = id;
  closeModal('newTreeOvl');
  await save(); renderAll();
}

function delTree() {
  if (!st.activeId) return;
  var id   = st.activeId;
  var name = st.trees[id].name;
  showConfirm('Delete Tree', 'Delete "' + name + '"? This cannot be undone.', 'Delete', async function() {
    await dbDelete('trees', id);
    delete st.trees[id];
    st.activeId = Object.keys(st.trees)[0] || null;
    selId = null;
    await save(); renderAll();
  });
}

function openRename() {
  if (!st.activeId) return;
  document.getElementById('renameInp').value = st.trees[st.activeId].name;
  document.getElementById('renameOvl').classList.add('on');
}

async function confirmRename() {
  var v = document.getElementById('renameInp').value.trim();
  if (v && st.activeId) { st.trees[st.activeId].name = v; await save(); renderAll(); }
  closeModal('renameOvl');
}

async function switchTree(id) {
  st.activeId = id || null; selId = null;
  await save(); renderAll();
}


// ── PERSON MANAGEMENT ────────────────────────────────────────

function openAddCouple() {
  var tree = activeTree();
  if (!tree) { alert('Create a tree first.'); return; }
  ['c1Name','c1Birth','c1Death','c1Label','c1Notes',
   'c2Name','c2Birth','c2Death','c2Label','c2Notes'].forEach(function(id){
    document.getElementById(id).value = '';
  });
  document.getElementById('coupleOvl').classList.add('on');
  setTimeout(function(){ document.getElementById('c1Name').focus(); }, 80);
}

async function saveCouple() {
  var tree  = activeTree(); if (!tree) return;
  var name1 = document.getElementById('c1Name').value.trim();
  if (!name1) { document.getElementById('c1Name').focus(); return; }

  var id1 = gid();
  var p1  = {
    id: id1, childIds: [], parentId: null, spouseId: null,
    name:              name1,
    birthDate:         document.getElementById('c1Birth').value.trim(),
    deathDate:         document.getElementById('c1Death').value.trim(),
    relationshipLabel: document.getElementById('c1Label').value.trim(),
    notes:             document.getElementById('c1Notes').value.trim()
  };
  tree.persons[id1] = p1;

  var name2 = document.getElementById('c2Name').value.trim();
  if (name2) {
    var id2 = gid();
    var p2  = {
      id: id2, childIds: [], parentId: null, spouseId: id1,
      name:              name2,
      birthDate:         document.getElementById('c2Birth').value.trim(),
      deathDate:         document.getElementById('c2Death').value.trim(),
      relationshipLabel: document.getElementById('c2Label').value.trim(),
      notes:             document.getElementById('c2Notes').value.trim()
    };
    p1.spouseId = id2;
    tree.persons[id2] = p2;
  }
  selId = id1;
  closeModal('coupleOvl');
  await save(); renderTree(); updateSel();
}

function openAdd(mode, relatedId) {
  var tree = activeTree();
  if (!tree) { alert('Create a tree first.'); return; }
  if ((mode === 'child' || mode === 'spouse' || mode === 'parent') && !selId && !relatedId) return;

  document.getElementById('mMode').value    = mode;
  document.getElementById('mRelated').value = relatedId || selId || '';
  document.getElementById('mEditId').value  = '';
  document.getElementById('mTitle').textContent =
    mode === 'child'  ? 'Add Child'  :
    mode === 'spouse' ? 'Add Spouse' :
    mode === 'parent' ? 'Add Parent' : 'Add Root Person';
  document.getElementById('mDelBtn').style.display = 'none';
  clearForm();
  document.getElementById('personOvl').classList.add('on');
  setTimeout(function(){ document.getElementById('fName').focus(); }, 80);
}

function openEdit(pid) {
  var tree = activeTree(); if (!tree || !tree.persons[pid]) return;
  var p = tree.persons[pid];
  document.getElementById('mMode').value    = 'edit';
  document.getElementById('mEditId').value  = pid;
  document.getElementById('mTitle').textContent = 'Edit Person';
  document.getElementById('mDelBtn').style.display = 'block';
  document.getElementById('fName').value  = p.name              || '';
  document.getElementById('fBirth').value = p.birthDate         || '';
  document.getElementById('fDeath').value = p.deathDate         || '';
  document.getElementById('fLabel').value = p.relationshipLabel || '';
  document.getElementById('fNotes').value = p.notes             || '';
  document.getElementById('personOvl').classList.add('on');
  setTimeout(function(){ document.getElementById('fName').focus(); }, 80);
}

function clearForm() {
  ['fName','fBirth','fDeath','fLabel','fNotes'].forEach(function(id){
    document.getElementById(id).value = '';
  });
}

function closeModal(id) { document.getElementById(id).classList.remove('on'); }

function showConfirm(title, msg, okLabel, cb) {
  document.getElementById('confirmTitle').textContent  = title;
  document.getElementById('confirmMsg').textContent    = msg;
  document.getElementById('confirmOkBtn').textContent  = okLabel || 'Confirm';
  _confirmCb = cb;
  document.getElementById('confirmOvl').classList.add('on');
}

function confirmDo() {
  closeModal('confirmOvl');
  if (_confirmCb) { var cb = _confirmCb; _confirmCb = null; cb(); }
}

async function savePerson() {
  var mode   = document.getElementById('mMode').value;
  var rel    = document.getElementById('mRelated').value;
  var editId = document.getElementById('mEditId').value;
  var tree   = activeTree(); if (!tree) return;
  var name   = document.getElementById('fName').value.trim();
  if (!name) { document.getElementById('fName').focus(); return; }

  var data = {
    name:              name,
    birthDate:         document.getElementById('fBirth').value.trim(),
    deathDate:         document.getElementById('fDeath').value.trim(),
    relationshipLabel: document.getElementById('fLabel').value.trim(),
    notes:             document.getElementById('fNotes').value.trim()
  };

  if (mode === 'edit' && editId) {
    Object.assign(tree.persons[editId], data);
  } else {
    var newId = gid();
    var p = Object.assign({ id:newId, childIds:[], parentId:null, spouseId:null }, data);
    tree.persons[newId] = p;
    if (mode === 'child' && rel && tree.persons[rel]) {
      tree.persons[rel].childIds.push(newId); p.parentId = rel;
    } else if (mode === 'spouse' && rel && tree.persons[rel]) {
      var ex = tree.persons[rel]; ex.spouseId = newId; p.spouseId = rel; p.parentId = ex.parentId;
    } else if (mode === 'parent' && rel && tree.persons[rel]) {
      p.childIds = [rel]; tree.persons[rel].parentId = newId;
    }
    selId = newId;
  }
  closeModal('personOvl');
  await save(); renderTree(); updateSel();
}

function deletePerson() {
  var editId = document.getElementById('mEditId').value;
  var tree   = activeTree(); if (!tree || !editId) return;
  var name   = (tree.persons[editId] || {}).name || 'this person';
  showConfirm('Delete Person', 'Delete ' + name + '? This cannot be undone.', 'Delete', async function() {
    removePerson(tree, editId);
    closeModal('personOvl');
    if (selId === editId) selId = null;
    await save(); renderTree(); updateSel();
  });
}

function removePerson(tree, pid) {
  var p = tree.persons[pid]; if (!p) return;
  if (p.parentId && tree.persons[p.parentId]) {
    var par = tree.persons[p.parentId];
    par.childIds = par.childIds.filter(function(x){ return x !== pid; });
    if (par.spouseId && tree.persons[par.spouseId])
      tree.persons[par.spouseId].childIds = tree.persons[par.spouseId].childIds.filter(function(x){ return x !== pid; });
  }
  if (p.spouseId && tree.persons[p.spouseId]) tree.persons[p.spouseId].spouseId = null;
  (p.childIds || []).forEach(function(cid){
    if (!tree.persons[cid]) return;
    if (p.spouseId && tree.persons[p.spouseId]) {
      var sp = tree.persons[p.spouseId];
      if (!sp.childIds.includes(cid)) sp.childIds.push(cid);
      tree.persons[cid].parentId = p.spouseId;
    } else {
      tree.persons[cid].parentId = null;
    }
  });
  delete tree.persons[pid];
}


// ── IMPORT / EXPORT ──────────────────────────────────────────

function exportJSON() {
  var payload = { version: 1, exported: new Date().toISOString(), trees: st.trees };
  var blob    = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  var url     = URL.createObjectURL(blob);
  var a       = document.createElement('a');
  var name    = activeTree() ? activeTree().name.replace(/\s+/g, '_') : 'family-chronicle';
  a.href = url; a.download = name + '.json'; a.click(); URL.revokeObjectURL(url);
}

function importJSON(inp) {
  var f = inp.files[0]; if (!f) return;
  var r = new FileReader();
  r.onload = async function(e) {
    try {
      var data  = JSON.parse(e.target.result);
      var trees = data.trees || null;
      if (!trees) { alert('Unrecognised JSON format.'); return; }
      for (var id in trees) {
        st.trees[id] = trees[id];
        await dbPut('trees', trees[id]);
      }
      var max = 0;
      Object.values(st.trees).forEach(function(t){
        Object.keys(t.persons || {}).forEach(function(pid){
          var n = parseInt(pid.slice(1)); if (n > max) max = n;
        });
        var tn = parseInt(t.id.slice(1)); if (tn > max) max = tn;
      });
      nid = max + 1;
      if (!st.activeId || !st.trees[st.activeId])
        st.activeId = Object.keys(st.trees)[0] || null;
      await save(); renderAll();
      alert('Import successful — ' + Object.keys(trees).length + ' tree(s) loaded.');
    } catch(err) { alert('Failed to read JSON: ' + err.message); }
  };
  r.readAsText(f); inp.value = '';
}


// ── SELECTION ────────────────────────────────────────────────

function selectNode(pid) {
  selId = pid;
  document.querySelectorAll('.node').forEach(function(n){
    n.classList.toggle('sel', n.dataset.id === pid);
  });
  updateSel();
}

function updateSel() {
  var sec  = document.getElementById('selInfo');
  if (!selId) { sec.style.display = 'none'; return; }
  var tree = activeTree();
  if (!tree || !tree.persons[selId]) { sec.style.display = 'none'; return; }
  var p = tree.persons[selId];
  sec.style.display = 'block';
  document.getElementById('selName').textContent = p.name || 'Unknown';
  var meta = [p.relationshipLabel, [p.birthDate, p.deathDate].filter(Boolean).join(' – ')].filter(Boolean).join(' · ');
  document.getElementById('selMeta').textContent = meta;
}


// ── CONTEXT MENU ─────────────────────────────────────────────

function showCtx(x, y, pid) {
  ctxId = pid;
  var m = document.getElementById('ctxMenu');
  m.style.left = x + 'px'; m.style.top = y + 'px';
  m.classList.add('on');
}
function hideCtx() { document.getElementById('ctxMenu').classList.remove('on'); }

function ctxDo(act) {
  hideCtx(); if (!ctxId) return;
  if      (act === 'edit')   openEdit(ctxId);
  else if (act === 'child')  openAdd('child',  ctxId);
  else if (act === 'spouse') openAdd('spouse', ctxId);
  else if (act === 'parent') openAdd('parent', ctxId);
  else if (act === 'delete') {
    var id   = ctxId;
    var tree = activeTree(); if (!tree) return;
    var name = (tree.persons[id] || {}).name || 'this person';
    showConfirm('Delete Person', 'Delete ' + name + '? This cannot be undone.', 'Delete', async function() {
      removePerson(tree, id); if (selId === id) selId = null;
      await save(); renderTree(); updateSel();
    });
  }
}


// ── PAN & ZOOM ───────────────────────────────────────────────

var px = 0, py = 0, sc = 1;
var panning = false, psx = 0, psy = 0, ptx = 0, pty = 0;

function applyTx() {
  document.getElementById('svgWrap').style.transform =
    'translate(' + px + 'px,' + py + 'px) scale(' + sc + ')';
  document.getElementById('zoomLbl').textContent = Math.round(sc * 100) + '%';
}

function doZoom(d) { sc = Math.max(.15, Math.min(3, sc + d)); applyTx(); }

function fitView() {
  var tree = activeTree();
  if (!tree || !Object.keys(tree.persons).length) return;
  var svg = document.getElementById('treeSvg');
  var cvs = document.getElementById('canvas');
  var sw  = parseFloat(svg.getAttribute('width')  || 0);
  var sh  = parseFloat(svg.getAttribute('height') || 0);
  if (!sw || !sh) return;
  var cw = cvs.clientWidth, ch = cvs.clientHeight, pad = 48;
  sc = Math.min((cw - pad*2) / sw, (ch - pad*2) / sh, 1.4);
  px = (cw - sw * sc) / 2;
  py = (ch - sh * sc) / 2;
  applyTx();
}

function setupPan() {
  var cv = document.getElementById('canvas');
  cv.addEventListener('mousedown', function(e){
    if (e.target.closest('.node')) return;
    panning = true; psx = e.clientX; psy = e.clientY; ptx = px; pty = py;
    cv.style.cursor = 'grabbing';
  });
  window.addEventListener('mousemove', function(e){
    if (!panning) return;
    px = ptx + (e.clientX - psx);
    py = pty + (e.clientY - psy);
    applyTx();
  });
  window.addEventListener('mouseup', function(){
    panning = false;
    document.getElementById('canvas').style.cursor = 'grab';
  });
  cv.addEventListener('wheel', function(e){
    e.preventDefault(); doZoom(e.deltaY > 0 ? -.08 : .08);
  }, { passive: false });
  cv.addEventListener('click', function(e){
    if (e.target === cv || e.target.id === 'treeSvg') {
      hideCtx(); selId = null;
      document.querySelectorAll('.node.sel').forEach(function(n){ n.classList.remove('sel'); });
      updateSel();
    }
  });
}


// ── RENDER ALL ───────────────────────────────────────────────

function renderAll() {
  var sel   = document.getElementById('treeSel');
  var trees = Object.values(st.trees);
  sel.innerHTML = '';
  if (!trees.length) {
    sel.innerHTML = '<option value="">— no trees —</option>';
    document.getElementById('btnRename').disabled = true;
    document.getElementById('btnDel').disabled    = true;
  } else {
    trees.forEach(function(t){
      var o = document.createElement('option');
      o.value = t.id; o.textContent = t.name; o.selected = (t.id === st.activeId);
      sel.appendChild(o);
    });
    document.getElementById('btnRename').disabled = false;
    document.getElementById('btnDel').disabled    = false;
  }
  renderTree(); updateSel();
}


// ── INIT ─────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async function() {
  setupPan();
  try {
    await openDB();
    await loadAll();
    setDBStatus(true, 'IndexedDB — auto-saved');
  } catch(e) {
    setDBStatus(false, 'DB error: ' + e.message);
    console.error('IndexedDB error:', e);
  }
  renderAll();

  var ls = document.getElementById('loadScreen');
  ls.classList.add('fade');
  setTimeout(function(){ ls.style.display = 'none'; }, 420);

  document.addEventListener('click', function(e){
    if (!e.target.closest('#ctxMenu')) hideCtx();
  });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape') {
      ['personOvl','renameOvl','newTreeOvl','coupleOvl','confirmOvl'].forEach(closeModal);
      hideCtx();
    }
    if (e.key === 'Enter' && document.getElementById('renameOvl').classList.contains('on'))
      confirmRename();
  });

  ['personOvl','renameOvl','coupleOvl','newTreeOvl','confirmOvl'].forEach(function(id){
    document.getElementById(id).addEventListener('click', function(e){
      if (e.target === e.currentTarget) closeModal(id);
    });
  });
  document.getElementById('newTreeInp').addEventListener('keydown', function(e){
    if (e.key === 'Enter') confirmNewTree();
  });
});
