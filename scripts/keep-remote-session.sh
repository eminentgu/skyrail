#!/bin/sh
# One-time, user-authorized macOS setting. Does not disable login passwords,
# FileVault, the screen lock shortcut or the normal idle-lock policy.
set -eu
if [ "$(id -u)" -ne 0 ]; then
  printf '%s\n' '仅关闭屏幕共享断开时恢复旧锁屏状态；需要在本机输入管理员密码。'
  exec sudo /bin/sh "$0"
fi
/usr/bin/defaults write /Library/Preferences/com.apple.RemoteManagement.plist RestoreMachineState -bool false
value=$(/usr/bin/defaults read /Library/Preferences/com.apple.RemoteManagement RestoreMachineState)
[ "$value" = 0 ] || { printf '%s\n' '未能确认设置，请检查系统偏好。'; exit 1; }
printf '%s\n' '已关闭屏幕共享断开时恢复旧锁屏状态。正常密码、手动锁屏和系统自动锁屏设置未修改。'
