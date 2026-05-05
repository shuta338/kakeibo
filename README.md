# 広告なし家計簿

iPhoneのSafariでホーム画面に追加して使う、個人用の家計簿PWAです。

## iPhoneで使う方法

1. このフォルダの中身をGitHub Pages、Netlify、Cloudflare PagesなどのHTTPS対応ホスティングへアップロードします。
2. iPhoneのSafariで公開URLを開きます。
3. 共有ボタンから「ホーム画面に追加」を選びます。
4. ホーム画面の「家計簿」アイコンから起動します。

## 一時テスト

Windowsで `start-server.bat` を開き、iPhoneのSafariで表示されたURLにアクセスします。

## データについて

入力データはブラウザ内の `localStorage` に保存されます。Safariのサイトデータを削除すると家計簿データも消える可能性があります。大事な記録はCSV出力でバックアップしてください。
