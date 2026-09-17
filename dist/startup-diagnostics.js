/* モジュールの読み込みに失敗しても、白画面にせず原因を確認できるようにする。 */
(function () {
  function report(message) {
    if (document.getElementById('startup-error')) return;
    var panel = document.createElement('section'); panel.id = 'startup-error';
    panel.style.cssText = 'position:fixed;inset:15px;z-index:10000;background:#fffbe9;color:#354c43;padding:20px;overflow:auto;border:2px solid #cf8061;border-radius:12px;font:14px sans-serif;white-space:pre-wrap;word-break:break-word';
    panel.textContent = '読み込み中にエラーが起きました\n\n' + message + '\n\nこの表示内容を教えてください。\nURL: ' + location.href + '\n' + navigator.userAgent;
    var close = document.createElement('button'); close.textContent = '閉じる'; close.onclick = function () { panel.remove(); }; panel.appendChild(document.createElement('hr')); panel.appendChild(close);
    document.body.appendChild(panel);
  }
  window.addEventListener('error', function (e) { if (e.message) report(e.message + '\n' + (e.filename || '') + ':' + e.lineno); });
  window.addEventListener('unhandledrejection', function (e) { report(String(e.reason && (e.reason.stack || e.reason.message) || e.reason)); });
  setTimeout(function () { var app = document.getElementById('app'); if (app && !app.children.length) report('ゲームの起動が完了していません。PCの開発サーバーが動いているか、Network URLとポート番号が正しいか確認してください。'); }, 15000);
}());
