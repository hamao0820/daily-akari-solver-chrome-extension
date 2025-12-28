# Daily Akari Solver

[Daily Akari](https://dailyakari.com/)の問題を自動的に解くChrome拡張機能です。

## セットアップ

**注意**: このリポジトリにはOpenCV.js (version 4.12.0) が含まれています。追加のダウンロードは不要です。

### Chrome拡張機能としてインストール

1. Chromeブラウザで `chrome://extensions/` を開く
3. 「パッケージ化されていない拡張機能を読み込む」ボタンをクリック
4. このディレクトリ（`chrome_extension`）を選択
5. 拡張機能リストに「daily akari solver」が追加されます

**注意**: デベロッパーモードで読み込んだ拡張機能は、Chrome再起動後も有効ですが、更新があった場合は拡張機能ページの「更新」ボタンをクリックする必要があります。

## 使い方

1. [Daily Akari](https://dailyakari.com/)の問題ページを開く
2. ページ右上に表示される「✨ Solve Akari」ボタンをクリック
3. 回答が自動的に入力されます

## Third Party Libraries

This project includes OpenCV.js (version 4.12.0) from the official OpenCV documentation:

- Source: https://docs.opencv.org/4.12.0/opencv.js
- OpenCV is licensed under Apache License 2.0
- **Note**: opencv.js is included in this repository for convenience

OpenCV copyright and license information:

- Full copyright details: See [COPYRIGHT](COPYRIGHT) file
- Full license text: See [LICENSE](LICENSE) file
- OpenCV Repository: https://github.com/opencv/opencv

## License

This Chrome extension (excluding third-party libraries) is provided as-is for educational purposes.

Third-party components (OpenCV.js) are subject to their respective licenses. See the [LICENSE](LICENSE) and [COPYRIGHT](COPYRIGHT) files for OpenCV licensing information.
