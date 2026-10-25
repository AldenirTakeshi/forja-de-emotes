// Forja de Emotes — interface principal.
(function (Forja) {
  "use strict";
  const R = Forja.render;

  const PRESETS = { emote: [112, 56, 28], badge: [72, 36, 18] };
  const TWITCH_MAX_BYTES = 1024 * 1024;
  const TWITCH_MAX_FRAMES = 60;

  const state = {
    preset: "emote", fit: "contain", pixel: false, trim: false,
    sel: new Set(PRESETS.emote), items: [],
  };
  const $ = s => document.querySelector(s);
  const list = $("#list"), statusEl = $("#status");
  let nextId = 1;

  const sizes = () => PRESETS[state.preset];
  const settings = () => ({ fit: state.fit, pixel: state.pixel, sizes: sizes() });

  function setStatus(text, cls) {
    statusEl.textContent = text || "";
    statusEl.className = "status" + (cls ? " " + cls : "");
  }

  const slug = s => (s || "emote")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "")
    .slice(0, 40) || "emote";

  const fmtBytes = n => n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(0) + " KB" : (n / 1048576).toFixed(2) + " MB";

  // ---------- animação das prévias ----------
  const anims = [];
  function tick(now) {
    for (const a of anims) {
      if (now >= a.next) {
        a.i = (a.i + 1) % a.frames.length;
        a.ctx.clearRect(0, 0, a.w, a.w);
        a.ctx.drawImage(a.frames[a.i], 0, 0);
        a.next = now + a.delays[a.i];
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  function previewCanvas(out) {
    const c = R.canvas(out.size, out.size), x = c.getContext("2d");
    x.drawImage(out.frames[0], 0, 0);
    if (out.frames.length > 1) anims.push({ ctx: x, w: out.size, frames: out.frames, delays: out.delays, i: 0, next: 0 });
    return c;
  }

  // ---------- processamento ----------
  function updateBox(item) {
    const srcs = item.frames ? item.frames.map(f => f.canvas) : [item.img];
    item.box = state.trim
      ? (item.trimBox ||= R.trimBox(srcs, item.w, item.h))
      : { x: 0, y: 0, w: item.w, h: item.h };
  }

  /** Gera os quadros finais de todos os tamanhos (com cache). */
  function render(item) {
    updateBox(item);
    const key = JSON.stringify([state.preset, state.fit, state.pixel, state.trim, item.crop]);
    if (item.out && item.out.key === key) return item.out.sizes;
    const srcs = item.frames ? item.frames.map(f => f.canvas) : [item.img];
    const delays = item.frames ? item.frames.map(f => f.delay) : [0];
    const result = sizes().map(size => ({ size, frames: [], delays }));
    for (const src of srcs) {
      const work = R.drawCrop(src, item.box, item.crop, state.fit, R.workSide(item.box, item.crop, state.fit, sizes()[0]), state.pixel);
      result.forEach(r => r.frames.push(R.resize(work, r.size, state.pixel)));
    }
    item.out = { key, sizes: result };
    return result;
  }

  // ---------- interface ----------
  function drawSizes() {
    const box = $("#sizes");
    box.innerHTML = "";
    for (const s of sizes()) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "mono"; b.textContent = `${s}×${s}`;
      b.setAttribute("aria-pressed", String(state.sel.has(s)));
      b.addEventListener("click", () => {
        state.sel.has(s) ? state.sel.delete(s) : state.sel.add(s);
        drawSizes();
      });
      box.append(b);
    }
  }

  function draw() {
    anims.length = 0;
    list.innerHTML = "";
    $("#zipAll").disabled = state.items.length === 0;
    if (!state.items.length) {
      const p = document.createElement("p");
      p.className = "empty";
      p.textContent = "Nenhum emote ainda. Solte imagens acima.";
      list.append(p);
      return;
    }
    for (const item of state.items) list.append(card(item));
  }

  function tag(text, cls) {
    const s = document.createElement("span");
    s.className = "tag mono" + (cls ? " " + cls : "");
    s.textContent = text;
    return s;
  }

  function card(item) {
    const outs = render(item);
    const el = document.createElement("article");
    el.className = "item";

    const src = document.createElement("div");
    src.className = "src checker";
    const im = document.createElement("img");
    im.src = item.url; im.alt = "Imagem original de " + item.name;
    src.append(im);

    const meta = document.createElement("div");
    meta.className = "meta";

    const r1 = document.createElement("div");
    r1.className = "row";
    const name = document.createElement("input");
    name.className = "name"; name.id = "name-" + item.id; name.value = item.name;
    name.setAttribute("aria-label", "Nome do emote");
    name.addEventListener("change", () => { item.name = slug(name.value); name.value = item.name; });
    r1.append(name, tag(`${item.w}×${item.h}`));
    if (item.example) r1.append(tag("exemplo", "ex"));
    if (item.frames) r1.append(tag(`GIF · ${item.frames.length} quadros`, "anim"));
    if (item.frames && item.frames.length > TWITCH_MAX_FRAMES) r1.append(tag(`acima de ${TWITCH_MAX_FRAMES} quadros`, "warn"));
    if (Math.min(item.w, item.h) < sizes()[0]) r1.append(tag("pequena: será ampliada", "warn"));
    if (item.w !== item.h && item.crop.zoom === 1 && item.crop.cx === 0.5 && item.crop.cy === 0.5) r1.append(tag("não quadrada", "warn"));
    if (item.crop.zoom !== 1 || item.crop.cx !== 0.5 || item.crop.cy !== 0.5) r1.append(tag("enquadramento ajustado"));

    const pv = document.createElement("div");
    pv.className = "previews";
    for (const mode of ["dark", "light"]) {
      const box = document.createElement("div");
      box.className = "chat " + mode;
      for (const o of outs) {
        const f = document.createElement("figure");
        const cap = document.createElement("figcaption");
        cap.textContent = `${o.size}×${o.size}`;
        f.append(previewCanvas(o), cap);
        box.append(f);
      }
      pv.append(box);
    }
    for (const mode of ["dark", "light"]) {
      const line = document.createElement("div");
      line.className = "chat inline " + mode;
      const b = document.createElement("b");
      b.textContent = "viewer:";
      line.append(b, document.createTextNode(" boa partida "), previewCanvas(outs[outs.length - 1]), document.createTextNode(" gg"));
      pv.append(line);
    }

    const act = document.createElement("div");
    act.className = "actions";
    const crop = document.createElement("button");
    crop.type = "button"; crop.className = "btn"; crop.textContent = "Enquadrar";
    crop.addEventListener("click", () => Forja.cropper.open(item, settings(), c => { item.crop = c; draw(); }));
    const dl = document.createElement("button");
    dl.type = "button"; dl.className = "btn"; dl.textContent = "Baixar este (.zip)";
    dl.addEventListener("click", () => exportZip([item], `${item.name}.zip`));
    const rm = document.createElement("button");
    rm.type = "button"; rm.className = "link"; rm.textContent = "Remover";
    rm.addEventListener("click", () => {
      if (!item.example) URL.revokeObjectURL(item.url);
      state.items = state.items.filter(i => i !== item);
      draw();
    });
    act.append(crop, dl, rm);

    meta.append(r1, pv, act);
    el.append(src, meta);
    return el;
  }

  // ---------- entrada de arquivos ----------
  function loadImage(src) {
    return new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = src;
    });
  }

  async function addFiles(files) {
    const imgs = [...files].filter(f => /^image\//.test(f.type));
    if (!imgs.length) { setStatus("Nenhuma imagem reconhecida. Use PNG, JPG, WEBP ou GIF.", "err"); return; }
    state.items = state.items.filter(i => !i.example);
    setStatus("Carregando…");
    for (const f of imgs) {
      const url = URL.createObjectURL(f);
      const item = { id: nextId++, name: slug(f.name), url, crop: { zoom: 1, cx: 0.5, cy: 0.5 } };
      try {
        if (f.type === "image/gif") {
          const g = Forja.gif.decode(await f.arrayBuffer());
          if (g.frames.length > 1) Object.assign(item, { w: g.w, h: g.h, frames: g.frames });
          else Object.assign(item, { w: g.w, h: g.h, img: g.frames[0].canvas });
        } else {
          const img = await loadImage(url);
          Object.assign(item, { img, w: img.naturalWidth, h: img.naturalHeight });
        }
        state.items.push(item);
      } catch (e) {
        console.error(e);
        setStatus(`Não consegui abrir ${f.name}.`, "err");
      }
    }
    setStatus(`${state.items.length} emote(s) prontos.`, "ok");
    draw();
  }

  // ---------- exportação ----------
  const toPng = c => new Promise(r => c.toBlob(b => b.arrayBuffer().then(a => r(new Uint8Array(a))), "image/png"));
  const nextFrame = () => new Promise(r => setTimeout(r, 0));

  function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function exportZip(items, filename) {
    if (!state.sel.size) { setStatus("Escolha pelo menos um tamanho em Exportar.", "err"); return; }
    const chosen = sizes().filter(s => state.sel.has(s));
    if (chosen.length === 1) filename = filename.replace(/\.zip$/, `_${chosen[0]}x${chosen[0]}.zip`);

    const entries = [], used = new Set(), heavy = [];
    for (const it of items) {
      let base = it.name, n = 2;
      while (used.has(base)) base = `${it.name}_${n++}`;
      used.add(base);
      for (const o of render(it).filter(o => state.sel.has(o.size))) {
        setStatus(`Gerando ${base} ${o.size}×${o.size}…`);
        await nextFrame();
        const anim = o.frames.length > 1;
        const data = anim ? Forja.gif.encode(o.frames, o.delays) : await toPng(o.frames[0]);
        const file = `${base}_${o.size}x${o.size}.${anim ? "gif" : "png"}`;
        entries.push({ name: file, data });
        if (data.length > TWITCH_MAX_BYTES) heavy.push(`${file} (${fmtBytes(data.length)})`);
      }
    }
    saveBlob(Forja.makeZip(entries), filename);
    if (heavy.length) setStatus(`Baixado, mas passou de 1 MB, limite da Twitch: ${heavy.join(", ")}. Tente cortar quadros do GIF.`, "err");
    else setStatus(`Baixado: ${filename} (${entries.length} arquivo${entries.length > 1 ? "s" : ""}).`, "ok");
  }

  // ---------- eventos ----------
  const drop = $("#drop"), file = $("#file");
  file.addEventListener("change", () => { addFiles(file.files); file.value = ""; });
  ["dragenter", "dragover"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", e => addFiles(e.dataTransfer.files));
  drop.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); file.click(); } });
  document.addEventListener("paste", e => {
    const f = [...(e.clipboardData?.files || [])];
    if (f.length) addFiles(f);
  });

  function seg(id, key, attr) {
    $(id).addEventListener("click", e => {
      const b = e.target.closest("button");
      if (!b) return;
      state[key] = b.dataset[attr];
      $(id).querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
      if (key === "preset") { state.sel = new Set(sizes()); drawSizes(); }
      draw();
    });
  }
  seg("#preset", "preset", "p");
  seg("#fit", "fit", "f");
  drawSizes();
  $("#pixel").addEventListener("change", e => { state.pixel = e.target.checked; draw(); });
  $("#trim").addEventListener("change", e => { state.trim = e.target.checked; draw(); });
  $("#zipAll").addEventListener("click", () => exportZip(state.items, state.preset === "badge" ? "insignias_twitch.zip" : "emotes_twitch.zip"));

  // ---------- exemplo inicial (some quando você adiciona os seus) ----------
  (async () => {
    if (!Forja.EXAMPLE) return draw();
    try {
      const img = await loadImage(Forja.EXAMPLE);
      state.items.push({ id: nextId++, name: "exemplo", url: Forja.EXAMPLE, img, w: img.naturalWidth, h: img.naturalHeight, example: true, crop: { zoom: 1, cx: 0.5, cy: 0.5 } });
    } catch (e) { console.error(e); }
    draw();
  })();
})(window.Forja = window.Forja || {});
