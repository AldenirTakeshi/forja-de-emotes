(function (Forja) {
  "use strict";

  const MAX_WORK = 2048;

  function canvas(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }

  function trimBox(sources, w, h) {
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (const src of sources) {
      const c = canvas(w, h), x = c.getContext("2d", { willReadFrequently: true });
      x.drawImage(src, 0, 0);
      const d = x.getImageData(0, 0, w, h).data;
      for (let y = 0; y < h; y++) {
        for (let xx = 0; xx < w; xx++) {
          if (d[(y * w + xx) * 4 + 3] > 8) {
            if (xx < minX) minX = xx; if (xx > maxX) maxX = xx;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
          }
        }
      }
    }
    if (maxX < 0) return { x: 0, y: 0, w, h };
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  }

  function cropRect(box, crop, fit) {
    const base = fit === "cover" ? Math.min(box.w, box.h) : Math.max(box.w, box.h);
    const side = base / crop.zoom;
    return { side, x0: crop.cx * box.w - side / 2, y0: crop.cy * box.h - side / 2 };
  }

  function drawCrop(src, box, crop, fit, N, pixel, target) {
    const out = target || canvas(N, N);
    const ctx = out.getContext("2d");
    ctx.clearRect(0, 0, out.width, out.height);
    ctx.imageSmoothingEnabled = !pixel;
    ctx.imageSmoothingQuality = "high";
    const r = cropRect(box, crop, fit), k = out.width / r.side;
    ctx.drawImage(src, box.x, box.y, box.w, box.h, -r.x0 * k, -r.y0 * k, box.w * k, box.h * k);
    return out;
  }

  function workSide(box, crop, fit, minSize) {
    const r = cropRect(box, crop, fit);
    return Math.max(minSize, Math.min(MAX_WORK, Math.round(r.side)));
  }

  function resize(src, size, pixel) {
    let cur = src;
    if (!pixel) {
      while (cur.width / 2 > size) {
        const n = canvas(Math.max(size, Math.floor(cur.width / 2)), Math.max(size, Math.floor(cur.width / 2)));
        const x = n.getContext("2d");
        x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high";
        x.drawImage(cur, 0, 0, n.width, n.height);
        cur = n;
      }
    }
    const out = canvas(size, size), x = out.getContext("2d");
    x.imageSmoothingEnabled = !pixel; x.imageSmoothingQuality = "high";
    x.drawImage(cur, 0, 0, size, size);
    return out;
  }

  Forja.render = { canvas, trimBox, cropRect, drawCrop, workSide, resize };
})(window.Forja = window.Forja || {});
