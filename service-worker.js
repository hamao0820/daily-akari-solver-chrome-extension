// solver.jsをインポート
importScripts("solver.js");

// content.jsからメッセージを受け取って処理し、結果をcontent.jsに返す
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      if (request.type === "getProblemData") {
        const problemData = await fetchProblemData(request.problemNo);
        sendResponse({ problemData });
      } else if (request.type === "getSolution") {
        // ブラウザ内でsolverを実行
        const result = solveAkari(request.problemData);
        if (result) {
          sendResponse(result);
        } else {
          sendResponse({ error: "No solution found" });
        }
      }
    } catch (err) {
      console.error("Error:", err);
      sendResponse({ error: err.message });
    }
  })();
  return true; // 非同期でsendResponseを呼び出すためにtrueを返す
});

const fetchProblemData = async (problemNo) => {
  const url =
    problemNo == -1
      ? "https://dailyakari.com/dailypuzzle?tz_offset=-540"
      : `https://dailyakari.com/archivepuzzle?number=${problemNo}&tz_offset=-540`;
  const response = await fetch(url);
  const data = await response.json();
  const link = data["puzzlink"];

  if (!link) {
    throw new Error("Problem data not found");
  }

  return decodeAkariBoard(link);
};

const decodeAkariBoard = (url) => {
  // URLからクエリパラメータ（?以降）を抽出し、スラッシュで分割
  const queryString = url.split("?")[1];
  if (!queryString) {
    throw new Error("無効なURL形式です");
  }

  const parts = queryString.split("/");
  // parts[0] = "akari", parts[1] = width, parts[2] = height, parts[3] = data
  const width = parseInt(parts[1], 10);
  const height = parseInt(parts[2], 10);
  const data = parts[3];

  const cells = [];

  // 文字列を1文字ずつ解析
  for (let i = 0; i < data.length; i++) {
    const char = data[i];

    if (char === ".") {
      // 数字なしの黒マス
      cells.push("#");
    } else if (char >= "0" && char <= "4") {
      // 0〜4の数字マス
      cells.push(char);
    } else if (char >= "5" && char <= "9") {
      // 数字マス + 白マス1個
      cells.push((parseInt(char, 10) - 5).toString());
      cells.push(".");
    } else if (char >= "a" && char <= "e") {
      // 数字マス + 白マス2個
      const num = char.charCodeAt(0) - "a".charCodeAt(0);
      cells.push(num.toString());
      cells.push(".");
      cells.push(".");
    } else if (char >= "g" && char <= "z") {
      // 連続する白マス (g=1, h=2, i=3, ... z=20)
      const spaces = char.charCodeAt(0) - "g".charCodeAt(0) + 1;
      for (let j = 0; j < spaces; j++) {
        cells.push(".");
      }
    } else {
      // 未知の文字（fなど）が来た場合のフォールバック（通常は発生しない）
      cells.push("?");
    }
  }

  // 1次元配列を指定された幅(width)で分割し、2次元配列に変換
  const board = [];
  for (let r = 0; r < height; r++) {
    board.push(cells.slice(r * width, (r + 1) * width));
  }

  return board;
};
