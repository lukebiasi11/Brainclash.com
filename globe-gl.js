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
uniform sampler2D t;uniform vec2 res;uniform vec3 c;uniform vec2 ll;
void main(){vec2 q=vec2(gl_FragCoord.x,res.y-gl_FragCoord.y);float x=(q.x-c.x)/c.z,y=-(q.y-c.y)/c.z,r2=x*x+y*y;
if(r2>1.0+4.0/c.z){discard;}float z=sqrt(max(0.,1.-r2));float s=sin(ll.y),k=cos(ll.y);
float lat=asin(clamp(z*s+y*k,-1.,1.)),lon=ll.x+atan(x,z*k-y*s);float tu=lon/6.2831853+.5;
float ua=fract(tu),ub=fract(tu+.5)-.5;float u=ua;` + (der ? "if(fwidth(ua)>fwidth(ub)+1e-6)u=ub;" : "") +
`vec3 col=texture2D(t,vec2(u,.5-lat/3.14159265)).rgb*(.72+.28*pow(z,.6));
float a=clamp((1.-sqrt(r2))*c.z+.5,0.,1.);gl_FragColor=vec4(col*a,a);}`;
  const sh = (ty, src) => { const s = gl.createShader(ty); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
  const v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs); if (!v || !f) return null;
  const pr = gl.createProgram(); gl.attachShader(pr, v); gl.attachShader(pr, f); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
  gl.useProgram(pr); const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const ap = gl.getAttribLocation(pr, "p"); gl.enableVertexAttribArray(ap); gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 0, 0);
  const U = n => gl.getUniformLocation(pr, n), uRes = U("res"), uC = U("c"), uLL = U("ll");
  const tex = gl.createTexture(); let ready = false, big = false, W = 1, H = 1, dpr = 1;
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
  el.insertBefore(cv, overlay);
  const api = {
    get ready() { return ready && !api.failed && !gl.isContextLost(); }, failed: false,
    size(w, h, d) { W = w; H = h; dpr = d; cv.width = Math.round(w * d); cv.height = Math.round(h * d); cv.style.width = w + "px"; cv.style.height = h + "px"; },
    zoom(k) { const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE); if (!big && k > 2.2 && maxTex >= 4096) { big = true; load("assets/earth-4096.jpg"); } },
    draw(proj) {
      if (!api.ready) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); return; }
      const t = proj.translate(), r = proj.rotate();
      gl.viewport(0, 0, cv.width, cv.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uRes, cv.width, cv.height); gl.uniform3f(uC, t[0] * dpr, t[1] * dpr, proj.scale() * dpr);
      gl.uniform2f(uLL, -r[0] * Math.PI / 180, -r[1] * Math.PI / 180); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  };
  cv.addEventListener("webglcontextlost", e => { e.preventDefault(); onReady(); });
  return api;
};
