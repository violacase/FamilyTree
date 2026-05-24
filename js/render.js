// SVG rendering — draws the tree onto #treeSvg

function renderTree() {
  var tree  = activeTree();
  var svg   = document.getElementById('treeSvg');
  var wrap  = document.getElementById('svgWrap');
  var empty = document.getElementById('emptyMsg');
  svg.innerHTML = '';

  if (!tree || !Object.keys(tree.persons).length) {
    empty.style.display = 'flex';
    wrap.style.display  = 'none';
    return;
  }
  empty.style.display = 'none';
  wrap.style.display  = 'block';

  var P   = tree.persons;
  var pos = doLayout(P);
  var allP = Object.values(pos);
  var mx  = Math.min.apply(null, allP.map(function(p){ return p.x; }))      - HG;
  var my  = Math.min.apply(null, allP.map(function(p){ return p.y; }))      - HG;
  var mxw = Math.max.apply(null, allP.map(function(p){ return p.x + NW; })) + HG;
  var mxh = Math.max.apply(null, allP.map(function(p){ return p.y + NH; })) + HG;
  var W = mxw - mx, H = mxh - my;

  svg.setAttribute('width',   W);
  svg.setAttribute('height',  H);
  svg.setAttribute('viewBox', mx + ' ' + my + ' ' + W + ' ' + H);

  var ns = 'http://www.w3.org/2000/svg';
  var eg = mkEl(ns, 'g'); svg.appendChild(eg); // edge layer
  var ng = mkEl(ns, 'g'); svg.appendChild(ng); // node layer

  // Edges
  Object.values(P).forEach(function(p) {
    var pp = pos[p.id]; if (!pp) return;

    // Spouse link
    if (p.spouseId && pos[p.spouseId] && p.id < p.spouseId) {
      var sp = pos[p.spouseId];
      var sy = pp.y + NH / 2;
      var x1 = pp.x + NW, x2 = sp.x;
      eg.appendChild(mkEl(ns, 'line', { x1:x1, y1:sy, x2:x2, y2:sy, 'class':'edge-sp' }));
      var ht = mkEl(ns, 'text', { x:(x1+x2)/2, y:sy+4, 'class':'sp-heart' });
      ht.textContent = '♥';
      eg.appendChild(ht);
    }

    // Parent-child links (primary parent only)
    if (isSecondary(p.id, P)) return;
    var kids = coupleKids(p.id, P);
    var kpos = kids.map(function(k){ return pos[k]; }).filter(Boolean);
    if (!kpos.length) return;

    var pmx  = pp.x + NW / 2;
    if (p.spouseId && pos[p.spouseId])
      pmx = (pp.x + NW + pos[p.spouseId].x) / 2;
    var pby  = pp.y + NH;
    var midy = pby + VG / 2;

    if (kpos.length === 1) {
      var cp = kpos[0], cxm = cp.x + NW / 2;
      eg.appendChild(mkEl(ns, 'path', {
        d: 'M' + pmx + ' ' + pby + ' C' + pmx + ' ' + midy + ',' + cxm + ' ' + midy + ',' + cxm + ' ' + cp.y,
        'class': 'edge-pc'
      }));
    } else {
      eg.appendChild(mkEl(ns, 'line', { x1:pmx, y1:pby,  x2:pmx, y2:midy, 'class':'edge-pc' }));
      var lx = Math.min.apply(null, kpos.map(function(c){ return c.x + NW / 2; }));
      var rx = Math.max.apply(null, kpos.map(function(c){ return c.x + NW / 2; }));
      eg.appendChild(mkEl(ns, 'line', { x1:lx, y1:midy, x2:rx, y2:midy, 'class':'edge-pc' }));
      kpos.forEach(function(cp){
        var cxm = cp.x + NW / 2;
        eg.appendChild(mkEl(ns, 'line', { x1:cxm, y1:midy, x2:cxm, y2:cp.y, 'class':'edge-pc' }));
      });
    }
  });

  // Nodes
  Object.values(P).forEach(function(p) {
    var pp = pos[p.id]; if (!pp) return;
    var g  = mkEl(ns, 'g', {
      'class':   'node' + (p.id === selId ? ' sel' : ''),
      transform: 'translate(' + pp.x + ',' + pp.y + ')',
      'data-id': p.id
    });

    // Shadow + background
    g.appendChild(mkEl(ns, 'rect', { x:3, y:4, width:NW, height:NH, rx:7, fill:'rgba(44,24,16,.11)' }));
    g.appendChild(mkEl(ns, 'rect', { width:NW, height:NH, rx:6, 'class':'node-bg' }));
    g.appendChild(mkEl(ns, 'rect', { width:NW, height:5,  rx:6, fill:'#b5860d', opacity:'.55' }));

    // Tooltip
    var tt = mkEl(ns, 'title');
    tt.textContent = [p.name, p.relationshipLabel,
      [p.birthDate, p.deathDate].filter(Boolean).join('–'),
      p.notes].filter(Boolean).join('\n');
    g.appendChild(tt);

    // Text content
    var ty = 24;
    var ne = mkEl(ns, 'text', { x:NW/2, y:ty, 'class':'n-name' });
    ne.textContent = p.name.length > 21 ? p.name.slice(0, 19) + '…' : p.name || 'Unknown';
    g.appendChild(ne); ty += 16;

    g.appendChild(mkEl(ns, 'line', { x1:12, y1:ty, x2:NW-12, y2:ty, stroke:'#c4a882', 'stroke-width':'.5' }));
    ty += 12;

    if (p.relationshipLabel) {
      var le = mkEl(ns, 'text', { x:NW/2, y:ty, 'class':'n-lbl' });
      le.textContent = p.relationshipLabel;
      g.appendChild(le); ty += 14;
    }

    var ds = [p.birthDate, p.deathDate].filter(Boolean).join(' – ');
    if (ds) {
      var de = mkEl(ns, 'text', { x:NW/2, y:ty, 'class':'n-date' });
      de.textContent = ds;
      g.appendChild(de);
    }

    if (p.notes) {
      var no = mkEl(ns, 'text', { x:NW-8, y:NH-7, 'class':'n-note' });
      no.textContent = '✎ notes';
      g.appendChild(no);
    }

    // Transparent hit area on top
    g.appendChild(mkEl(ns, 'rect', { width:NW, height:NH, rx:6, fill:'transparent' }));

    g.addEventListener('click',       function(e){ e.stopPropagation(); hideCtx(); selectNode(p.id); });
    g.addEventListener('dblclick',    function(e){ e.stopPropagation(); openEdit(p.id); });
    g.addEventListener('contextmenu', function(e){ e.preventDefault(); e.stopPropagation(); selectNode(p.id); showCtx(e.clientX, e.clientY, p.id); });
    ng.appendChild(g);
  });
}

function mkEl(ns, tag, attrs) {
  attrs = attrs || {};
  var el = document.createElementNS(ns, tag);
  Object.keys(attrs).forEach(function(k){ el.setAttribute(k, attrs[k]); });
  return el;
}
