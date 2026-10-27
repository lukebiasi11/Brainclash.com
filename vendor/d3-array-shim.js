/* Minimal stand-ins for the three d3-array helpers d3-geo calls (Adder, merge, range).
 * Original code written for Daily Gauntlet; this is not part of the d3-array library. Load before d3-geo.min.js. */
(function (g) {
  var d3 = g.d3 = g.d3 || {};
  // Compensated (Neumaier) summation; d3-geo only needs add() and valueOf().
  function Adder() { this._s = 0; this._c = 0; }
  Adder.prototype.add = function (x) { x = +x; var s = this._s, t = s + x;
    this._c += Math.abs(s) >= Math.abs(x) ? (s - t) + x : (x - t) + s; this._s = t; return this; };
  Adder.prototype.valueOf = function () { return this._s + this._c; };
  d3.Adder = Adder;
  d3.merge = function (arrays) { var out = []; for (var i = 0; i < arrays.length; i++) for (var j = 0; j < arrays[i].length; j++) out.push(arrays[i][j]); return out; };
  d3.range = function (start, stop, step) {
    var n = arguments.length; if (n < 2) { stop = start; start = 0; } step = n < 3 ? 1 : +step;
    var len = Math.max(0, Math.ceil((stop - start) / step)) | 0, r = new Array(len);
    for (var i = 0; i < len; i++) r[i] = start + i * step; return r; };
})(typeof globalThis !== "undefined" ? globalThis : this);
