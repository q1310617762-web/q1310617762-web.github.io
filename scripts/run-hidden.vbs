' 以「完全隐藏窗口」的方式运行自动发布脚本
' 由 Windows 计划任务调用：wscript.exe run-hidden.vbs
' 窗口样式 0 = 隐藏，不会创建可见窗口，因此不会抢焦点、不会把游戏弹到桌面
Option Explicit

Dim fso, sh, scriptDir, ps1, cmd
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
ps1 = scriptDir & "\auto-publish.ps1"

If Not fso.FileExists(ps1) Then
  WScript.Quit 1
End If

cmd = "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & ps1 & """"

' 第二个参数 0 = 隐藏窗口；第三个参数 False = 不等待（立即返回，不阻塞计划任务）
sh.Run cmd, 0, False
