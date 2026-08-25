import base64
import subprocess

ps = r'''
$ws = New-Object -ComObject WScript.Shell
$s = $ws.CreateShortcut("C:\Users\admin\Desktop\Boss 刷新倒计时.lnk")
$s.TargetPath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$s.Arguments = "--app=https://shixianbudu.github.io/boss-timer/"
$s.IconLocation = "F:\项目资料\2026.04\水保\甘孜州色达县洛若村推进乡村建设重点基础设施建设项目\boss-timer\public\icons\app.ico"
$s.Description = "Boss 刷新倒计时"
$s.Save()
'''

enc = base64.b64encode(ps.encode("utf-16-le")).decode()
r = subprocess.run(
    [r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe", "-NoProfile", "-EncodedCommand", enc],
    capture_output=True,
    text=True,
)
print("rc =", r.returncode)
print(r.stdout)
print(r.stderr)
