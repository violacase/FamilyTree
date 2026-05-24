// Tree layout — pure functions, no DOM access
// Produces a {pid: {x, y}} position map for all persons in a tree.

var NW = 160; // node width
var NH = 90;  // node height
var HG = 32;  // horizontal gap between siblings
var VG = 68;  // vertical gap between generations
var CG = 22;  // gap between couple nodes

function isSecondary(pid, persons) {
  var p = persons[pid]; if (!p || !p.spouseId) return false;
  var sp = persons[p.spouseId]; if (!sp || sp.spouseId !== pid) return false;
  return parseInt(pid.slice(1)) > parseInt(p.spouseId.slice(1));
}

function coupleKids(pid, persons) {
  var p = persons[pid]; if (!p) return [];
  var s = new Set(p.childIds || []);
  if (p.spouseId && persons[p.spouseId])
    (persons[p.spouseId].childIds || []).forEach(function(x){ s.add(x); });
  return Array.from(s).filter(function(x){ return persons[x]; });
}

function subW(pid, persons) {
  if (!persons[pid]) return NW + HG;
  var p    = persons[pid];
  var kids = coupleKids(pid, persons);
  var own  = (p.spouseId && persons[p.spouseId]) ? NW * 2 + CG + HG : NW + HG;
  if (!kids.length) return own;
  return Math.max(own, kids.reduce(function(s, c){ return s + subW(c, persons); }, 0));
}

function doLayout(persons) {
  var pos   = {};
  var roots = Object.values(persons).filter(function(p){
    return !p.parentId && !isSecondary(p.id, persons);
  });

  function place(pid, sx, y) {
    if (!persons[pid] || pos[pid]) return;
    var p  = persons[pid];
    var sw = subW(pid, persons);
    var cx = sx + sw / 2;
    var kids = coupleKids(pid, persons);

    if (p.spouseId && persons[p.spouseId]) {
      pos[p.id]       = { x: cx - NW - CG / 2, y: y };
      pos[p.spouseId] = { x: cx + CG / 2,      y: y };
    } else {
      pos[p.id] = { x: cx - NW / 2, y: y };
    }

    var totKW = kids.reduce(function(s, c){ return s + subW(c, persons); }, 0);
    var kx    = cx - totKW / 2;
    kids.forEach(function(c){
      place(c, kx, y + NH + VG);
      kx += subW(c, persons);
    });
  }

  var x = HG / 2;
  roots.forEach(function(p){
    place(p.id, x, HG / 2);
    x += subW(p.id, persons) + HG;
  });

  return pos;
}
