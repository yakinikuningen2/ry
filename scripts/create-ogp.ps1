$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectRoot = Split-Path -Parent $PSScriptRoot
$bitmap = New-Object System.Drawing.Bitmap(1200, 630)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.Clear([System.Drawing.Color]::White)
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$ink = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(24,24,24))
$gray = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(110,110,110))
$wash = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(245,245,245))
$small = [System.Drawing.Font]::new('Yu Gothic', 24, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$large = [System.Drawing.Font]::new('Yu Gothic', 66, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$result = [System.Drawing.Font]::new('Yu Gothic', 88, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$graphics.DrawString('勝手に略すな。', $small, $ink, 64, 42)
$graphics.DrawLine([System.Drawing.Pens]::LightGray, 64, 98, 1136, 98)
$graphics.DrawString("その名前、`n勝手に略します。", $large, $ink, 58, 151)
$graphics.FillRectangle($wash, 700, 137, 436, 360)
$graphics.DrawString('ポケットモンスター', $small, $gray, 759, 184)
$graphics.DrawString('ポモター', $result, $ink, 727, 268)
$graphics.DrawString('と呼んでください。', $small, $gray, 777, 409)
$graphics.DrawString('意味不明だけど、微妙にそれっぽい。', $small, $gray, 64, 538)
$graphics.DrawString('#勝手に略すな', $small, $ink, 926, 538)
$bitmap.Save((Join-Path $projectRoot 'assets/ogp.png'), [System.Drawing.Imaging.ImageFormat]::Png)
foreach ($resource in @($graphics, $bitmap, $ink, $gray, $wash, $small, $large, $result)) { $resource.Dispose() }
Write-Output 'Created assets/ogp.png (1200 x 630)'
