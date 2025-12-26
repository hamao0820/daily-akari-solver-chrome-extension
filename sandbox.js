let cvReady = false;

// OpenCVの読み込み完了
function onOpenCvReady() {
  cvReady = true;
  console.log("OpenCV.js loaded in sandbox");
  window.parent.postMessage({ type: "opencv-ready" }, "*");
}

// OpenCVの初期化
if (typeof cv !== "undefined") {
  if (cv.getBuildInformation) {
    onOpenCvReady();
  } else {
    cv["onRuntimeInitialized"] = onOpenCvReady;
  }
}

// 親ウィンドウからのメッセージを受信
window.addEventListener("message", (event) => {
  if (!cvReady) {
    window.parent.postMessage({ type: "error", message: "OpenCV not ready", messageId: event.data.messageId }, "*");
    return;
  }

  const { type, imageData, width, height, messageId } = event.data;

  try {
    let src = cv.matFromImageData(imageData);
    let dst = new cv.Mat();
    let result;

    if (type === "detectCells") {
      const cells = detectCells(src, event.data.rows, event.data.cols);
      // 元の画像に円を描画
      dst = src.clone();
      for (const cell of cells) {
        cv.circle(dst, new cv.Point(cell.centerX, cell.centerY), 5, new cv.Scalar(0, 255, 0, 255), -1);
      }

      // 結果を親ウィンドウに送信（セル情報付き）
      result = new ImageData(new Uint8ClampedArray(dst.data), dst.cols, dst.rows);
      src.delete();
      dst.delete();
      window.parent.postMessage(
        {
          type: "result",
          imageData: result,
          cells: cells,
          messageId: messageId,
        },
        "*",
      );
      return;
    } else {
      throw new Error("Unknown operation: " + type);
    }
  } catch (error) {
    console.error("Processing error:", error);
    window.parent.postMessage(
      {
        type: "error",
        message: error.message,
        messageId: messageId,
      },
      "*",
    );
  }
});

// セル検出関数（detect.goの移植）
function detectCells(img, rows, cols) {
  // 輪郭検出
  const contours = findContours(img);

  // ボード領域の矩形を計算
  const boardRect = calcBoardRectangle(contours);

  // マージンを計算（元のGoコードから）
  const margin = Math.floor(20.526 - 0.009 * (rows * cols));

  // クロップ領域
  const croppedRect = new cv.Rect(
    boardRect.x + margin,
    boardRect.y + margin,
    boardRect.width - 2 * margin,
    boardRect.height - 2 * margin,
  );

  // セルの中心位置を計算
  const width = croppedRect.width;
  const height = croppedRect.height;

  const centersIntervalX = width / (2 * cols);
  const centersIntervalY = height / (2 * rows);

  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let centerX = centersIntervalX * (2 * c + 1);
      let centerY = centersIntervalY * (2 * r + 1);

      // 少し外側にずらす（元のGoコードのロジック）
      if (c < cols / 2) {
        centerX -= centersIntervalX * 0.15;
      } else if (c > cols / 2) {
        centerX += centersIntervalX * 0.15;
      }
      if (r < rows / 2) {
        centerY -= centersIntervalY * 0.15;
      } else if (r > rows / 2) {
        centerY += centersIntervalY * 0.15;
      }

      cells.push({
        row: r,
        col: c,
        centerX: Math.floor(centerX + croppedRect.x),
        centerY: Math.floor(centerY + croppedRect.y),
      });
    }
  }

  return cells;
}

// 輪郭を検出（Cannyエッジ検出と膨張処理）
function findContours(img) {
  const gray = new cv.Mat();
  cv.cvtColor(img, gray, cv.COLOR_RGBA2GRAY);

  const edges = new cv.Mat();
  cv.Canny(gray, edges, 50, 50);

  const dilated = new cv.Mat();
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
  cv.dilate(edges, dilated, kernel, new cv.Point(-1, -1), 2);

  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(dilated, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

  // クリーンアップ
  gray.delete();
  edges.delete();
  dilated.delete();
  kernel.delete();
  hierarchy.delete();

  return contours;
}

// ボード領域の矩形を計算
function calcBoardRectangle(contours) {
  if (contours.size() === 0) {
    throw new Error("輪郭が検出されませんでした");
  }

  let minX = Infinity,
    minY = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity;

  for (let i = 0; i < contours.size(); i++) {
    const contour = contours.get(i);
    const rect = cv.boundingRect(contour);

    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  }

  // クリーンアップ
  contours.delete();

  return new cv.Rect(minX, minY, maxX - minX, maxY - minY);
}
