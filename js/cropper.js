// Editor de corte: arrastar para mover, roda do mouse ou controle para zoom.
(function (Forja) {
  "use strict";
  const R = Forja.render;
  const ZMIN = 0.5, ZMAX = 8;

  let dlg, stage, stageCanvas, zoomInput, zoomOut, prevBox, title, applyBtn, cancelBtn, centerBtn, resetBtn;
  let ctx = null; // sessão atual

  function build() {
    dlg = document.getElementById("cropDialog");
    stage = dlg.querySelector(".stage");
    stageCanvas = stage.querySelector("canvas");
    zoomInput = dlg.querySelector("#cropZoom");
    zoomOut = dlg.querySelector("#cropZoomVal");
    prevBox = dlg.querySelector(".crop-prev");
    title = dlg.querySelector("#cropTitle");
    applyBtn = dlg.querySelector("#cropApply");
    cancelBtn = dlg.querySelector("#cropCancel");
    centerBtn = dlg.querySelector("#cropCenter");
    resetBtn = dlg.querySelector("#cropReset");

    // Zoom em escala logarítmica no controle deslizante
    zoomInput.addEventListener("input", () => setZoom(Math.exp(+zoomInput.value)));

    let drag = null;
    stage.addEventListener("pointerdown", e => {
      stage.setPointerCapture(e.pointerId);
      drag = { x: e.clientX, y: e.clientY };
    });
    stage.addEventListener("pointermove", e => {
      if (!drag || !ctx) return;
      pan(e.clientX - drag.x, e.clientY - drag.y);
      drag = { x: e.clientX, y: e.clientY };
    });
    const end = () => { drag = null; };
    stage.addEventListener("pointerup", end);
    stage.addEventListener("pointercancel", end);
    stage.addEventListener("wheel", e => {
      e.preventDefault();
      setZoom(ctx.crop.zoom * Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });
    stage.addEventListener("keydown", e => {
      const step = e.shiftKey ? 10 : 2;
      const map = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
      if (map[e.key]) { e.preventDefault(); pan(...map[e.key]); }
      if (e.key === "+" || e.key === "=") setZoom(ctx.crop.zoom * 1.1);
      if (e.key === "-") setZoom(ctx.crop.zoom / 1.1);
    });

    centerBtn.addEventListener("click", () => { ctx.crop.cx = 0.5; ctx.crop.cy = 0.5; paint(); });
    resetBtn.addEventListener("click", () => { ctx.crop = { zoom: 1, cx: 0.5, cy: 0.5 }; paint(); });
    cancelBtn.addEventListener("click", () => dlg.close());
    applyBtn.addEventListener("click", () => { ctx.onApply({ ...ctx.crop }); dlg.close(); });
    dlg.addEventListener("close", () => { ctx = null; });
  }

  /** Move o corte acompanhando o arraste (dx, dy em pixels de tela). */
  function pan(dx, dy) {
    const r = R.cropRect(ctx.box, ctx.crop, ctx.settings.fit);
    const scale = r.side / stage.clientWidth;
    ctx.crop.cx -= (dx * scale) / ctx.box.w;
    ctx.crop.cy -= (dy * scale) / ctx.box.h;
    paint();
  }

  function setZoom(z) {
    ctx.crop.zoom = Math.min(ZMAX, Math.max(ZMIN, z));
    paint();
  }

  function paint() {
    const { src, box, crop, settings } = ctx;
    R.drawCrop(src, box, crop, settings.fit, stageCanvas.width, settings.pixel, stageCanvas);
    zoomInput.value = Math.log(crop.zoom).toFixed(3);
    zoomOut.textContent = Math.round(crop.zoom * 100) + "%";
    const work = R.drawCrop(src, box, crop, settings.fit, R.workSide(box, crop, settings.fit, settings.sizes[0]), settings.pixel);
    prevBox.querySelectorAll("canvas").forEach((c, i) => {
      const out = R.resize(work, settings.sizes[i], settings.pixel);
      c.width = c.height = settings.sizes[i];
      c.getContext("2d").drawImage(out, 0, 0);
    });
  }

  /**
   * @param item     emote (usa item.name, item.source(), item.box)
   * @param settings { fit, pixel, sizes }
   * @param onApply  recebe o novo crop
   */
  function open(item, settings, onApply) {
    if (!dlg) build();
    ctx = { src: item.frames ? item.frames[0].canvas : item.img, box: item.box, crop: { ...item.crop }, settings, onApply };
    title.textContent = "Enquadrar " + item.name;
    zoomInput.min = Math.log(ZMIN); zoomInput.max = Math.log(ZMAX);
    prevBox.innerHTML = "";
    for (const s of settings.sizes) {
      const f = document.createElement("figure");
      const c = document.createElement("canvas");
      const cap = document.createElement("figcaption");
      cap.textContent = `${s}×${s}`;
      f.append(c, cap);
      prevBox.append(f);
    }
    dlg.showModal();
    paint();
    stage.focus();
  }

  Forja.cropper = { open };
})(window.Forja = window.Forja || {});
