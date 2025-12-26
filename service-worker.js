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
      : `https://dailyakari.com/archivepuzzle?number=${problemNo}?tz_offset=-540`;
  const response = await fetch(url);
  const data = await response.json();
  const levelData = data["levelData"];

  // \n\nより手前が問題のデータ
  const problemDataText = levelData.split("\n\n")[0];
  const problemData = problemDataText.split("\n").map((line) => line.split(" "));
  return problemData;
};
