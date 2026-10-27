// Realistic textured globe (WebGL, no library). Paints NASA Blue Marble (graded) under the 2D overlay canvas
// that app.js uses for borders, pins and the arc. Same d3 orthographic projection, so taps map 1:1.
// Imagery: NASA Earth Observatory / Blue Marble: Next Generation (Reto Stöckli), public domain.
window.MAP_BORDERS = true; // ← set false for the no-borders look (v4 option 2)
// Light coastline outline over ALL land, same style everywhere (no answer-specific marks). 110m at the global view;
// Natural Earth 1:50m (vendor/coast-50m.js, lazy-loaded on first zoom) once zoomed so small islands stay visible.
window.BCCoast = (function () {
  let rings = null, loading = false, m110 = null;
  function decode() { const D = Math.PI / 180; rings = window.COAST_50M.map(d => { const c = []; let x = d[0], y = d[1]; c.push([x / 100, y / 100]);
    for (let i = 2; i < d.length; i += 2) { x += d[i]; y += d[i + 1]; c.push([x / 100, y / 100]); }
    let sx = 0, sy = 0, sz = 0; c.forEach(([lo, la]) => { sx += Math.cos(la * D) * Math.cos(lo * D); sy += Math.cos(la * D) * Math.sin(lo * D); sz += Math.sin(la * D); });
    const ctr = [Math.atan2(sy, sx) / D, Math.atan2(sz, Math.hypot(sx, sy)) / D]; let rad = 0; c.forEach(p => { rad = Math.max(rad, d3.geoDistance(ctr, p)); });
    return { c, ctr, rad }; }); }
  return function draw(ctx, path, proj, k, land110, W, H, redraw) {
    if (k >= 1.6 && !rings) { if (window.COAST_50M) decode(); else if (!loading) { loading = true; const sc = document.createElement("script"); sc.src = "vendor/coast-50m.js"; sc.onload = () => { decode(); redraw(); }; document.head.appendChild(sc); } }
    const a = Math.min(0.8, 0.22 + 0.12 * k), w = Math.min(1.2, 0.55 + 0.08 * k);
    ctx.beginPath();
    if (rings && k >= 1.6) { const r = proj.rotate(), ctr = [-r[0], -r[1]], vr = Math.asin(Math.min(1, Math.hypot(W, H) / 2 / proj.scale()));
      const vis = []; for (const g of rings) if (d3.geoDistance(ctr, g.ctr) < vr + g.rad) vis.push(g.c);
      path({ type: "MultiLineString", coordinates: vis }); }
    else { if (!m110) { const t = window.WORLD_ATLAS_110M; m110 = window.topojson.mesh(t, t.objects.land); } path(m110); } // lines, not polygons: no horizon artifacts
    ctx.lineWidth = w; ctx.strokeStyle = "rgba(255,248,232," + a + ")"; ctx.stroke();
  };
})();
window.BCGlobeGL = function (el, overlay, onReady) {
  const cv = document.createElement("canvas"); cv.className = "globe-gl"; cv.setAttribute("aria-hidden", "true");
  let gl = null; try { gl = cv.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false }); } catch (e) {}
  if (!gl) return null;
  const der = !!gl.getExtension("OES_standard_derivatives");
  const vs = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
  const fs = (der ? "#extension GL_OES_standard_derivatives : enable\n" : "") + `precision highp float;
uniform sampler2D t;uniform vec2 res;uniform vec3 c;uniform vec2 ll;uniform sampler2D rt;uniform vec4 rb;uniform float ron;
vec3 hsv(vec3 c){vec4 K=vec4(0.,-1./3.,2./3.,-1.);vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));
float d=q.x-min(q.w,q.y);return vec3(abs(q.z+(q.w-q.y)/(6.*d+1e-10)),d/(q.x+1e-10),q.x);}
vec3 rgb(vec3 c){vec3 p=abs(fract(c.xxx+vec3(1.,2./3.,1./3.))*6.-3.);return c.z*mix(vec3(1.),clamp(p-1.,0.,1.),c.y);}
vec3 grade(vec3 c){vec3 h=hsv(c);h.y=min(1.,h.y*1.35);return clamp((rgb(h)-.5)*1.15+.52,0.,1.);} // same grade as assets/earth-*.jpg
void main(){vec2 q=vec2(gl_FragCoord.x,res.y-gl_FragCoord.y);float x=(q.x-c.x)/c.z,y=-(q.y-c.y)/c.z,r2=x*x+y*y;
if(r2>1.0+4.0/c.z){discard;}float z=sqrt(max(0.,1.-r2));float s=sin(ll.y),k=cos(ll.y);
float lat=asin(clamp(z*s+y*k,-1.,1.)),lon=ll.x+atan(x,z*k-y*s);float tu=lon/6.2831853+.5;
float ua=fract(tu),ub=fract(tu+.5)-.5;float u=ua;` + (der ? "if(fwidth(ua)>fwidth(ub)+1e-6)u=ub;" : "") +
`vec3 col=texture2D(t,vec2(u,.5-lat/3.14159265)).rgb;
if(ron>.5){float ru=mod(lon-rb.x,6.2831853)/rb.z,rv=(rb.y-lat)/rb.w;if(ru>=0.&&ru<=1.&&rv>=0.&&rv<=1.){vec4 s4=texture2D(rt,vec2(ru,rv));
if(s4.a>.5){col=mix(col,grade(s4.rgb),smoothstep(.03,.08,max(s4.r,s4.g)));}}} // sharp land from tiles; ocean stays the base navy
col*=(.72+.28*pow(z,.6));
float a=clamp((1.-sqrt(r2))*c.z+.5,0.,1.);gl_FragColor=vec4(col*a,a);}`;
  const sh = (ty, src) => { const s = gl.createShader(ty); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
  const v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs); if (!v || !f) return null;
  const pr = gl.createProgram(); gl.attachShader(pr, v); gl.attachShader(pr, f); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
  gl.useProgram(pr); const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const ap = gl.getAttribLocation(pr, "p"); gl.enableVertexAttribArray(ap); gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 0, 0);
  const U = n => gl.getUniformLocation(pr, n), uRes = U("res"), uC = U("c"), uLL = U("ll"), uRT = U("rt"), uRB = U("rb"), uRon = U("ron"); gl.uniform1i(U("t"), 0); gl.uniform1i(uRT, 1);
  let api_stats; const tex = gl.createTexture(); let ready = false, big = false, W = 1, H = 1, dpr = 1;
  function load(src, cb) {
    const img = new Image(); img.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      if (der) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
      else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      const ext = gl.getExtension("EXT_texture_filter_anisotropic"); if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, 4);
      ready = true; cb && cb(); onReady();
    }; img.onerror = () => { if (!ready) api.failed = true; onReady(); }; img.src = src;
  }
  load("assets/earth-2048.jpg");
  // ---- Deep-zoom sharpening: stream NASA GIBS Blue Marble: Next Generation (500 m, public domain) tiles for the visible area only.
  // Same tiles worldwide (nothing answer-specific). Missing/failed tiles fall back to the base texture.
  const GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/BlueMarble_NextGeneration/default/2004-07-01/500m/";
  const rtex = gl.createTexture(), rc = document.createElement("canvas"), rx = rc.getContext("2d");
  const maxDim = Math.min(3072, gl.getParameter(gl.MAX_TEXTURE_SIZE)); let reg = null, dirty = false; const cache = new Map();
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, rtex);
  [[gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR]].forEach(([a, b]) => gl.texParameteri(gl.TEXTURE_2D, a, b));
  gl.activeTexture(gl.TEXTURE0);
  api_stats = { tiles: 0, bytes: 0 };
  let fetchT = 0; // only download once the view settles (no wasted tiles while zooming through levels)
  function tile(L, row, col, fetch) {
    const key = L + "/" + row + "/" + col; let e = cache.get(key);
    if (e) { cache.delete(key); cache.set(key, e); return e; } // LRU touch
    if (!fetch) return null;
    e = { img: new Image(), ok: false }; e.img.crossOrigin = "anonymous";
    e.img.onload = () => { e.ok = true; api_stats.tiles++; if (reg && reg.L === L) paint(L, row, col, e); };
    e.img.src = GIBS + key + ".jpeg"; cache.set(key, e);
    while (cache.size > 96) cache.delete(cache.keys().next().value);
    return e;
  }
  function paint(L, row, col, e) { // draw a loaded tile into the region canvas if it belongs there
    const span = 288 / (1 << L), nC = Math.round(360 / span);
    for (let x = reg.x0; x <= reg.x1; x++) if (((x % nC) + nC) % nC === col && row >= reg.y0 && row <= reg.y1) {
      rx.drawImage(e.img, (x - reg.x0) * 512, (row - reg.y0) * 512); dirty = true; onReady(); }
  }
  function region(proj, k) {
    if (k < 2.5 || window.BC_SHARP === false) { reg = null; return; }
    const need = proj.scale() * dpr * Math.PI / 180, r = proj.rotate(), c0 = -r[0];
    let lo1 = 1e9, lo2 = -1e9, la1 = 90, la2 = -90; la1 = 1e9; la2 = -1e9;
    for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) { const p = proj.invert([W * i / 8, H * j / 8]); if (!p || !isFinite(p[0])) continue;
      const [cx, cy] = proj.translate(); if (Math.hypot(W * i / 8 - cx, H * j / 8 - cy) > proj.scale()) continue;
      const d = ((p[0] - c0 + 540) % 360) - 180; lo1 = Math.min(lo1, c0 + d); lo2 = Math.max(lo2, c0 + d); la1 = Math.min(la1, p[1]); la2 = Math.max(la2, p[1]); }
    if (lo1 > lo2) { reg = null; return; }
    for (let L = 7; L >= 4; L--) {
      const span = 288 / (1 << L); if (L > 4 && 512 / span > need * 2.2) continue; // finer than the screen needs
      const x0 = Math.floor((lo1 + 180) / span), x1 = Math.floor((lo2 + 180) / span), nR = Math.round(180 / span);
      const y0 = Math.max(0, Math.floor((90 - la2) / span)), y1 = Math.min(nR - 1, Math.floor((90 - la1) / span));
      const nx = x1 - x0 + 1, ny = y1 - y0 + 1; if (nx * 512 > maxDim || ny * 512 > maxDim) continue;
      if (reg && reg.L === L && x0 >= reg.x0 && x1 <= reg.x1 && y0 >= reg.y0 && y1 <= reg.y1) return; // still covered
      const X0 = Math.max(x0 - (nx < maxDim / 512 ? 1 : 0), x0), nC = Math.round(360 / span); // (no padding: keep data small)
      reg = { L, x0: X0, x1, y0, y1, span }; rc.width = (x1 - X0 + 1) * 512; rc.height = ny * 512; rx.clearRect(0, 0, rc.width, rc.height);
      const R0 = reg; clearTimeout(fetchT); fetchT = setTimeout(() => { if (reg !== R0) return;
        for (let y = y0; y <= y1; y++) for (let x = X0; x <= x1; x++) tile(L, y, ((x % nC) + nC) % nC, true); }, 250);
      for (let y = y0; y <= y1; y++) for (let x = X0; x <= x1; x++) { const col = ((x % nC) + nC) % nC, e = tile(L, y, col); if (e && e.ok) rx.drawImage(e.img, (x - X0) * 512, (y - y0) * 512); }
      dirty = true; return;
    }
    reg = null;
  }
  el.insertBefore(cv, overlay);
  const api = {
    get stats() { return Object.assign({ level: reg && reg.L, cached: cache.size }, api_stats); },
    get ready() { return ready && !api.failed && !gl.isContextLost(); }, failed: false,
    size(w, h, d) { W = w; H = h; dpr = d; cv.width = Math.round(w * d); cv.height = Math.round(h * d); cv.style.width = w + "px"; cv.style.height = h + "px"; },
    zoom(k) { const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE); if (!big && k > 2.2 && maxTex >= 4096) { big = true; load("assets/earth-4096.jpg"); } },
    draw(proj) {
      if (!api.ready) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); return; }
      const t = proj.translate(), r = proj.rotate();
      gl.viewport(0, 0, cv.width, cv.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uRes, cv.width, cv.height); gl.uniform3f(uC, t[0] * dpr, t[1] * dpr, proj.scale() * dpr);
      gl.uniform2f(uLL, -r[0] * Math.PI / 180, -r[1] * Math.PI / 180);
      region(proj, proj.scale() / Math.max(1, Math.min(W, H) / 2 - 8));
      if (reg && dirty) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, rtex); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, rc); } catch (e) { reg = null; } gl.activeTexture(gl.TEXTURE0); dirty = false; }
      const D = Math.PI / 180; gl.uniform1f(uRon, reg ? 1 : 0);
      if (reg) gl.uniform4f(uRB, (reg.x0 * reg.span - 180) * D, (90 - reg.y0 * reg.span) * D, (reg.x1 - reg.x0 + 1) * reg.span * D, (reg.y1 - reg.y0 + 1) * reg.span * D);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  };
  el._gl = api;
  cv.addEventListener("webglcontextlost", e => { e.preventDefault(); onReady(); });
  return api;
};
