/**
 * Akari Solver - Content Script
 * Detects cells using OpenCV.js and solves the puzzle
 */

// Sandbox manager for OpenCV.js
class SandboxManager {
  constructor() {
    this.frame = null;
    this.ready = false;
    this.resolvers = new Map();
    this.messageId = 0;
  }

  async init() {
    if (this.frame) {
      if (this.ready) return;
      throw new Error("Sandbox is initializing");
    }

    return new Promise((resolve) => {
      this.frame = document.createElement("iframe");
      this.frame.src = chrome.runtime.getURL("sandbox.html");
      this.frame.style.display = "none";

      window.addEventListener("message", (event) => this.handleMessage(event));

      this.frame.addEventListener("load", () => {
        // Wait for OpenCV ready message
      });

      document.body.appendChild(this.frame);

      // Store resolve for opencv-ready message
      this.initResolve = resolve;
    });
  }

  handleMessage(event) {
    if (event.source !== this.frame?.contentWindow) return;

    const { type, messageId } = event.data;

    if (type === "opencv-ready") {
      this.ready = true;
      console.log("OpenCV ready in sandbox");
      this.initResolve?.();
    } else if (type === "result" || type === "error") {
      const resolver = this.resolvers.get(messageId);
      if (resolver) {
        if (type === "result") {
          resolver.resolve(event.data);
        } else {
          resolver.reject(new Error(event.data.message));
        }
        this.resolvers.delete(messageId);
      }
    }
  }

  async sendMessage(message, timeout = 30000) {
    if (!this.ready) {
      throw new Error("Sandbox not ready");
    }

    return new Promise((resolve, reject) => {
      const id = this.messageId++;
      message.messageId = id;

      this.resolvers.set(id, { resolve, reject });
      this.frame.contentWindow.postMessage(message, "*");

      setTimeout(() => {
        if (this.resolvers.has(id)) {
          this.resolvers.delete(id);
          reject(new Error("Sandbox timeout"));
        }
      }, timeout);
    });
  }
}

// UI Button Manager
class SolveButton {
  constructor(onClick) {
    this.button = this.createButton();
    this.button.addEventListener("click", onClick);
    document.body.appendChild(this.button);
  }

  createButton() {
    const button = document.createElement("button");
    button.innerText = "✨ Solve Akari";

    Object.assign(button.style, {
      position: "fixed",
      top: "10px",
      right: "20px",
      zIndex: "1000",
      padding: "12px 24px",
      fontSize: "16px",
      fontWeight: "600",
      color: "#fff",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      border: "none",
      borderRadius: "25px",
      cursor: "pointer",
      boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)",
      transition: "all 0.3s ease",
      fontFamily: "system-ui, -apple-system, sans-serif",
    });

    this.addHoverEffects(button);
    return button;
  }

  addHoverEffects(button) {
    button.addEventListener("mouseenter", () => {
      button.style.transform = "translateY(-2px)";
      button.style.boxShadow = "0 6px 20px rgba(102, 126, 234, 0.6)";
    });

    button.addEventListener("mouseleave", () => {
      button.style.transform = "translateY(0)";
      button.style.boxShadow = "0 4px 15px rgba(102, 126, 234, 0.4)";
    });

    button.addEventListener("mousedown", () => {
      button.style.transform = "translateY(0) scale(0.95)";
    });

    button.addEventListener("mouseup", () => {
      button.style.transform = "translateY(-2px) scale(1)";
    });
  }

  setLoading(loading) {
    this.button.disabled = loading;
    this.button.style.opacity = loading ? "0.6" : "1";
    this.button.style.cursor = loading ? "not-allowed" : "pointer";
    this.button.innerText = loading ? "⏳ Solving..." : "✨ Solve Akari";
  }
}

// Main solver logic
class AkariSolver {
  constructor() {
    this.sandbox = new SandboxManager();
  }

  async getCanvasImageData() {
    const iframe = document.querySelector("iframe");
    const canvas = iframe.contentDocument.querySelector("canvas");
    const dataURL = canvas.toDataURL("image/png");

    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = dataURL;
    });

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = img.width;
    tempCanvas.height = img.height;
    const ctx = tempCanvas.getContext("2d");
    ctx.drawImage(img, 0, 0);

    return {
      imageData: ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height),
      canvas,
    };
  }

  getProblemNumber() {
    const match = window.location.href.match(/\/archive\/(\d+)/);
    return match ? parseInt(match[1], 10) : -1;
  }

  async detectCells(imageData, problemData) {
    const result = await this.sandbox.sendMessage({
      type: "detectCells",
      imageData,
      width: imageData.width,
      height: imageData.height,
      rows: problemData.length,
      cols: problemData[0].length,
    });

    return result.cells.map((cell) => ({
      Row: cell.row,
      Col: cell.col,
      Center: {
        X: cell.centerX,
        Y: cell.centerY,
      },
    }));
  }

  async solve() {
    await this.sandbox.init();

    const { imageData, canvas } = await this.getCanvasImageData();
    const problemNo = this.getProblemNumber();

    const { problemData } = await chrome.runtime.sendMessage({
      type: "getProblemData",
      problemNo,
    });

    const cells = await this.detectCells(imageData, problemData);

    const { solution } = await chrome.runtime.sendMessage({
      type: "getSolution",
      problemData,
    });

    await this.applySolution(canvas, cells, solution);
  }

  async applySolution(canvas, cells, solutions) {
    // Sort solutions by row and column
    solutions.sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]));

    console.log("Applying solution:", solutions);

    // デバイスピクセル比を考慮
    const iframe = document.querySelector("iframe");
    const iframeWindow = iframe.contentWindow;
    const devicePixelRatio = iframeWindow.devicePixelRatio || 1;

    // Canvas の表示サイズと内部解像度の比率を計算
    const scaleX = canvas.width / canvas.offsetWidth;
    const scaleY = canvas.height / canvas.offsetHeight;

    console.log("Scale factors:", { devicePixelRatio, scaleX, scaleY });

    for (const [row, col] of solutions) {
      const cell = cells.find((c) => c.Row === row && c.Col === col);
      if (!cell) {
        console.error(`Cell not found for solution: [${row}, ${col}]`);
        continue;
      }

      // Canvas座標 → 表示座標に変換
      const clientX = cell.Center.X / scaleX;
      const clientY = cell.Center.Y / scaleY;

      const mousedownEvent = new MouseEvent("mousedown", {
        clientX,
        clientY,
        bubbles: true,
        cancelable: true,
        view: iframeWindow,
      });
      canvas.dispatchEvent(mousedownEvent);

      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

// Initialize on page load
window.addEventListener("load", async () => {
  const solver = new AkariSolver();

  const solveButton = new SolveButton(async () => {
    solveButton.setLoading(true);
    try {
      await solver.solve();
    } catch (error) {
      console.error("Solve error:", error);
      alert(`解答に失敗しました: ${error.message}`);
    } finally {
      solveButton.setLoading(false);
    }
  });
});
