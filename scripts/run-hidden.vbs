' 以「完全隐藏窗口」的方式运行自动发布脚本
' 由 Windows 计划任务调用：wscript.exe run-hidden.vbs
'
' 关键点：
'   1) 窗口样式 0 (SW_HIDE) —— 进程从创建起就没有窗口，不会抢焦点、不会把全屏游戏弹到桌面
'   2) 直接调用 node 执行 auto-publish.mjs（不再经过 PowerShell），
'      其内部所有子进程都带 windowsHide，全程无任何控制台窗口
Option Explicit

Dim fso, sh, scriptDir, mjs, nodeExe, cmd
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
mjs = scriptDir & "\auto-publish.mjs"

If Not fso.FileExists(mjs) Then
  WScript.Quit 1
End If

' 定位 node.exe：优先用 PATH，找不到再试常见安装位置
nodeExe = ""
On Error Resume Next
nodeExe = sh.ExpandEnvironmentStrings("%ProgramFiles%\nodejs\node.exe")
If Not fso.FileExists(nodeExe) Then
  nodeExe = sh.ExpandEnvironmentStrings("%LOCALAPPDATA%\Programs\nodejs\node.exe")
End If
If Not fso.FileExists(nodeExe) Then
  nodeExe = "node.exe"   ' 交给 PATH 解析
End If
On Error GoTo 0

cmd = """" & nodeExe & """ """ & mjs & """"

' 0 = 隐藏窗口，False = 不等待
sh.Run cmd, 0, False
