(function (Forja) {
  "use strict";
  const { canvas } = Forja.render;

  function decode(buffer) {
    const gif = GifUct.parseGIF(buffer);
    const raw = GifUct.decompressFrames(gif, true);
    const w = gif.lsd.width, h = gif.lsd.height;
    const main = canvas(w, h), mctx = main.getContext("2d", { willReadFrequently: true });
    const patchC = canvas(1, 1), pctx = patchC.getContext("2d");
    const frames = [];
    let prev = null, saved = null;

    for (const f of raw) {
      if (prev) {
        if (prev.disposalType === 2) mctx.clearRect(prev.dims.left, prev.dims.top, prev.dims.width, prev.dims.height);
        else if (prev.disposalType === 3 && saved) mctx.putImageData(saved, 0, 0);
      }
      saved = f.disposalType === 3 ? mctx.getImageData(0, 0, w, h) : null;

      const { width, height, left, top } = f.dims;
      if (width > 0 && height > 0) {
        patchC.width = width; patchC.height = height;
        pctx.putImageData(new ImageData(new Uint8ClampedArray(f.patch), width, height), 0, 0);
        mctx.drawImage(patchC, left, top);
      }

      const fc = canvas(w, h);
      fc.getContext("2d").drawImage(main, 0, 0);
      frames.push({ canvas: fc, delay: f.delay > 10 ? f.delay : 100 });
      prev = f;
    }
    return { w, h, frames };
  }

  function encode(canvases, delays) {
    const { GIFEncoder, quantize, applyPalette } = GifEnc;
    const size = canvases[0].width;
    const datas = canvases.map(c => c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, size, size).data);

    const all = new Uint8ClampedArray(datas.reduce((a, d) => a + d.length, 0));
    let o = 0;
    for (const d of datas) { all.set(d, o); o += d.length; }
    const palette = quantize(all, 256, { format: "rgba4444", oneBitAlpha: true });
    const transparentIndex = palette.findIndex(c => c[3] === 0);
    const hasAlpha = transparentIndex >= 0;

    const enc = GIFEncoder();
    datas.forEach((d, i) => {
      const index = applyPalette(d, palette, "rgba4444");
      enc.writeFrame(index, size, size, {
        palette: i === 0 ? palette : undefined,
        delay: delays[i],
        transparent: hasAlpha,
        transparentIndex: hasAlpha ? transparentIndex : 0,
        dispose: hasAlpha ? 2 : 1,
        repeat: 0,
      });
    });
    enc.finish();
    return enc.bytes();
  }

  Forja.gif = { decode, encode };
})(window.Forja = window.Forja || {});
