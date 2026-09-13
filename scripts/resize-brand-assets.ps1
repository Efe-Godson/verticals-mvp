# One-off asset generation using .NET System.Drawing (no new npm/image
# tooling needed) - creates smaller derivative files rather than touching
# the existing verticals-logo.png / verticals-mark.png (per prior guidance:
# don't replace existing branding). See the SEO Implementation follow-up
# notes for why these exist: the originals are 2161x728 (828KB) and
# 1254x1254 (756KB) but get displayed at ~20px tall in two spots
# (OnboardingPage.jsx, PublicDemoExperience.jsx) and reused as-is for the
# 1200x630 Open Graph/Twitter image - both real, measurable performance/SEO
# issues (brief sections 18, 22, 24).
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$publicDir = Join-Path $root 'public'

function New-ResizedPng {
    param(
        [string]$SourcePath,
        [string]$DestPath,
        [int]$TargetHeight
    )
    $src = [System.Drawing.Image]::FromFile($SourcePath)
    $ratio = $TargetHeight / $src.Height
    $targetWidth = [int][Math]::Round($src.Width * $ratio)
    $dest = New-Object System.Drawing.Bitmap($targetWidth, $TargetHeight)
    $dest.SetResolution($src.HorizontalResolution, $src.VerticalResolution)
    $g = [System.Drawing.Graphics]::FromImage($dest)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($src, 0, 0, $targetWidth, $TargetHeight)
    $g.Dispose()
    $dest.Save($DestPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $dest.Dispose()
    $src.Dispose()
    Write-Output "Wrote $DestPath ($targetWidth x $TargetHeight)"
}

# Small logo for the two ~20px-tall usages - 160px tall gives 8x headroom
# over the largest current display size, comfortably retina-safe.
New-ResizedPng -SourcePath (Join-Path $publicDir 'verticals-logo.png') `
    -DestPath (Join-Path $publicDir 'verticals-logo-sm.png') `
    -TargetHeight 160

# Dedicated 1200x630 Open Graph/Twitter image: the square mark, scaled down
# and centered on a canvas filled with the mark's own corner color (sampled
# directly rather than assumed, so it matches exactly - no visible seam).
$markPath = Join-Path $publicDir 'verticals-mark.png'
$mark = [System.Drawing.Image]::FromFile($markPath)
$markBitmap = New-Object System.Drawing.Bitmap($mark)
$bgColor = $markBitmap.GetPixel(2, 2)

$ogWidth = 1200
$ogHeight = 630
$og = New-Object System.Drawing.Bitmap($ogWidth, $ogHeight)
$g = [System.Drawing.Graphics]::FromImage($og)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$brush = New-Object System.Drawing.SolidBrush($bgColor)
$g.FillRectangle($brush, 0, 0, $ogWidth, $ogHeight)

$markSize = 420
$markX = [int](($ogWidth - $markSize) / 2)
$markY = [int](($ogHeight - $markSize) / 2)
$g.DrawImage($mark, $markX, $markY, $markSize, $markSize)
$g.Dispose()
$og.Save((Join-Path $publicDir 'verticals-og.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$og.Dispose()
$markBitmap.Dispose()
$mark.Dispose()
Write-Output "Wrote $(Join-Path $publicDir 'verticals-og.png') ($ogWidth x $ogHeight, bg RGB($($bgColor.R),$($bgColor.G),$($bgColor.B)))"
