// @ts-check
/* dashboard.js → Hero photo clean-up (1.13.3)
   Merchants upload product shots on a white studio background. Dropped as-is on a coloured hero they show as a white
   box. On upload we flood-fill the near-white border region to transparent (only pixels connected to the edge, so
   white parts inside the product survive). When nothing could be removed (a real photo), the slide is flagged
   `imageStyle: "card"` and the storefront shows it as a rounded card instead. Runs in the browser; no server work. */

/** @param {DashboardCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, { cleanHeroImage });

  const WHITE = 232; // min(r,g,b) at or above this = background candidate
  const MIN_REMOVED = 0.03; // at least 3 % of pixels removed → treat as a cut-out

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("صورة غير صالحة"));
      image.src = src;
    });
  }

  /** @returns {boolean} true when the image already has transparent pixels */
  function hasAlpha(data) {
    for (let i = 3; i < data.length; i += 4) if (data[i] < 250) return true;
    return false;
  }

  /** Flood fill from the four borders over near-white pixels; returns how many pixels were cleared. */
  function knockOutWhite(data, width, height) {
    const isWhite = (p) => data[p * 4] >= WHITE && data[p * 4 + 1] >= WHITE && data[p * 4 + 2] >= WHITE;
    const seen = new Uint8Array(width * height);
    const stack = [];
    const push = (x, y) => {
      const p = y * width + x;
      if (!seen[p] && isWhite(p)) {
        seen[p] = 1;
        stack.push(p);
      }
    };
    for (let x = 0; x < width; x += 1) {
      push(x, 0);
      push(x, height - 1);
    }
    for (let y = 0; y < height; y += 1) {
      push(0, y);
      push(width - 1, y);
    }
    let removed = 0;
    while (stack.length) {
      const p = /** @type {number} */ (stack.pop());
      data[p * 4 + 3] = 0;
      removed += 1;
      const x = p % width;
      const y = (p - x) / width;
      if (x > 0) push(x - 1, y);
      if (x < width - 1) push(x + 1, y);
      if (y > 0) push(x, y - 1);
      if (y < height - 1) push(x, y + 1);
    }
    return removed;
  }

  /** Softens the cut edge: semi-transparent 1px rim where an opaque pixel touches a cleared one. */
  function featherEdges(data, width, height) {
    const alpha = new Uint8Array(width * height);
    for (let p = 0; p < alpha.length; p += 1) alpha[p] = data[p * 4 + 3];
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const p = y * width + x;
        if (!alpha[p]) continue;
        if (!alpha[p - 1] || !alpha[p + 1] || !alpha[p - width] || !alpha[p + width]) data[p * 4 + 3] = 150;
      }
    }
  }

  /**
   * @param {string} dataUrl resized upload (any format)
   * @returns {Promise<{ dataUrl: string, style: "float" | "card" }>}
   */
  async function cleanHeroImage(dataUrl) {
    const image = await loadImage(dataUrl);
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return { dataUrl, style: "card" };
    context.drawImage(image, 0, 0);
    const frame = context.getImageData(0, 0, canvas.width, canvas.height);
    if (hasAlpha(frame.data)) return { dataUrl, style: "float" };
    const removed = knockOutWhite(frame.data, canvas.width, canvas.height);
    if (removed / (canvas.width * canvas.height) < MIN_REMOVED) return { dataUrl, style: "card" };
    featherEdges(frame.data, canvas.width, canvas.height);
    context.putImageData(frame, 0, 0);
    const out = canvas.toDataURL("image/webp", 0.9);
    // Browsers without WebP export fall back to PNG (keeps the alpha channel too).
    return { dataUrl: out.startsWith("data:image/webp") ? out : canvas.toDataURL("image/png"), style: "float" };
  }
}
