@echo off
:: 设置输出文件
set OUTPUT_FILE=structure.txt

:: 清空现有的输出文件
type nul > %OUTPUT_FILE%

:: 使用tree命令生成目录结构，并排除不需要的文件和目录
echo 正在生成项目结构...

:: 使用PowerShell来获取和过滤目录结构
powershell -Command "Get-ChildItem -Directory -Recurse | Where-Object { $_.FullName -notmatch '\\(env|venv|__pycache__|.git|.pytest_cache|.idea|.vscode|migrations|old_cache|test_cache|node_modules|instance|uploads|.ocr_cache)\\?' } | Select-Object -ExpandProperty FullName | ForEach-Object { $_.Replace('%CD%', '.') } | Sort-Object" > temp.txt

:: 读取临时文件并格式化为树形结构
echo . > %OUTPUT_FILE%
for /f "tokens=*" %%a in (temp.txt) do (
    set "line=%%a"
    setlocal enabledelayedexpansion
    echo !line:%CD%=.! >> %OUTPUT_FILE%
    endlocal
)

:: 删除临时文件
del temp.txt

echo 项目结构已生成到 %OUTPUT_FILE%
echo 请检查并编辑文件添加注释说明。

:: 使用记事本打开生成的文件
notepad %OUTPUT_FILE%