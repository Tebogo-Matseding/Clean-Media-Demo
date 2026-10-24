<#
.SYNOPSIS
  Scans the gallery image folders, sorts every image into portrait or landscape,
  and writes portfolio-manifest.js for the website.

.DESCRIPTION
  Put this file in the site root (next to index.html) and run:
      powershell -ExecutionPolicy Bypass -File .\Build-Portfolio-Manifest.ps1

  Re-run it whenever you add, remove or replace photos.

  Portrait  = taller than wide.
  Landscape = wider than tall (squares count as landscape).

  Sub-categories are listed in the order the website HTML shows them.
  If you add a sub-category, add it to $Config below.
#>
[CmdletBinding()]
param(
  [string]$SiteRoot = $PSScriptRoot,
  [string]$OutFile  = 'portfolio-manifest.js'
)

$ErrorActionPreference = 'Stop'
if (-not $SiteRoot) { $SiteRoot = (Get-Location).Path }
$SiteRoot = (Resolve-Path -LiteralPath $SiteRoot).Path.TrimEnd('\', '/')

# Slug = the name used on the website. Dir = the real folder name inside <Gallery>/images
$Config = @(
  @{ Category = 'corporate'; Gallery = 'corporate-gallery'; Subs = @(
      @{ Slug = 'professional-headshots'; Dir = 'professional-headshots' },
      @{ Slug = 'fashion';                Dir = 'fashion' }
  ) },
  @{ Category = 'lifestyle'; Gallery = 'lifestyle-gallery'; Subs = @(
      @{ Slug = 'maternity';              Dir = 'maternity' },
      @{ Slug = 'matric-farewell';        Dir = 'matric-farewell' },
      @{ Slug = 'graduation';             Dir = 'graduation' },
      @{ Slug = 'birthday';               Dir = 'birthday' },
      @{ Slug = 'outdoor-photography';    Dir = 'outdoor-photography' },
      @{ Slug = 'studio-photography';     Dir = 'studio-photography' },
      @{ Slug = 'cake-smash-photography'; Dir = 'cake-smash-photography' }
  ) },
  @{ Category = 'events'; Gallery = 'events-gallery'; Subs = @(
      @{ Slug = 'weddings';    Dir = 'weddings' },
      @{ Slug = 'celebration'; Dir = 'celebrations' },
      @{ Slug = 'festive';     Dir = 'festive' }
  ) }
)

$Extensions = @('.webp', '.jpg', '.jpeg', '.png')

# ---------------------------------------------------------------------------
# Read width/height straight from the file header (no extra software needed)
# ---------------------------------------------------------------------------
function Get-ImageSize {
  param([string]$Path)

  $ext = [IO.Path]::GetExtension($Path).ToLowerInvariant()

  try {
    if ($ext -eq '.webp') {
      $fs = [IO.File]::OpenRead($Path)
      try {
        $b = New-Object byte[] 32
        $n = $fs.Read($b, 0, 32)
      } finally { $fs.Dispose() }
      if ($n -lt 30) { return $null }

      $riff = [Text.Encoding]::ASCII.GetString($b, 0, 4)
      $webp = [Text.Encoding]::ASCII.GetString($b, 8, 4)
      $fmt  = [Text.Encoding]::ASCII.GetString($b, 12, 4)
      if ($riff -cne 'RIFF' -or $webp -cne 'WEBP') { return $null }

      if ($fmt -ceq 'VP8 ') {            # lossy
        $w = ([int]$b[26] + ([int]$b[27] -shl 8)) -band 0x3FFF
        $h = ([int]$b[28] + ([int]$b[29] -shl 8)) -band 0x3FFF
        return [pscustomobject]@{ W = $w; H = $h }
      }
      elseif ($fmt -ceq 'VP8L') {        # lossless
        $bits = [long]$b[21] + ([long]$b[22] -shl 8) + ([long]$b[23] -shl 16) + ([long]$b[24] -shl 24)
        $w = ($bits -band 0x3FFF) + 1
        $h = (($bits -shr 14) -band 0x3FFF) + 1
        return [pscustomobject]@{ W = $w; H = $h }
      }
      elseif ($fmt -ceq 'VP8X') {        # extended (metadata / animation)
        $w = 1 + [int]$b[24] + ([int]$b[25] -shl 8) + ([int]$b[26] -shl 16)
        $h = 1 + [int]$b[27] + ([int]$b[28] -shl 8) + ([int]$b[29] -shl 16)
        return [pscustomobject]@{ W = $w; H = $h }
      }
      return $null
    }

    if ($ext -eq '.png') {
      $fs = [IO.File]::OpenRead($Path)
      try {
        $b = New-Object byte[] 24
        $n = $fs.Read($b, 0, 24)
      } finally { $fs.Dispose() }
      if ($n -lt 24 -or $b[1] -ne 0x50 -or $b[2] -ne 0x4E -or $b[3] -ne 0x47) { return $null }
      $w = ([int]$b[16] -shl 24) + ([int]$b[17] -shl 16) + ([int]$b[18] -shl 8) + [int]$b[19]
      $h = ([int]$b[20] -shl 24) + ([int]$b[21] -shl 16) + ([int]$b[22] -shl 8) + [int]$b[23]
      return [pscustomobject]@{ W = $w; H = $h }
    }

    if ($ext -eq '.jpg' -or $ext -eq '.jpeg') {
      $b = [IO.File]::ReadAllBytes($Path)
      if ($b.Length -lt 4 -or $b[0] -ne 0xFF -or $b[1] -ne 0xD8) { return $null }
      $i = 2
      while ($i + 9 -lt $b.Length) {
        if ($b[$i] -ne 0xFF) { $i++; continue }
        $m = $b[$i + 1]
        if ($m -eq 0xFF) { $i++; continue }
        if ($m -eq 0x01 -or ($m -ge 0xD0 -and $m -le 0xD9)) { $i += 2; continue }
        $len = ([int]$b[$i + 2] -shl 8) + [int]$b[$i + 3]
        if ($m -ge 0xC0 -and $m -le 0xCF -and $m -ne 0xC4 -and $m -ne 0xC8 -and $m -ne 0xCC) {
          $h = ([int]$b[$i + 5] -shl 8) + [int]$b[$i + 6]
          $w = ([int]$b[$i + 7] -shl 8) + [int]$b[$i + 8]
          return [pscustomobject]@{ W = $w; H = $h }
        }
        $i += 2 + $len
      }
      return $null
    }
  } catch {
    return $null
  }
  return $null
}

function ConvertTo-JsString {
  param([string]$s)
  return '"' + ($s -replace '\\', '\\' -replace '"', '\"') + '"'
}

# ---------------------------------------------------------------------------
# Scan
# ---------------------------------------------------------------------------
$unreadable = New-Object System.Collections.Generic.List[string]
$summary    = New-Object System.Collections.Generic.List[object]
$catBlocks  = New-Object System.Collections.Generic.List[string]

foreach ($cat in $Config) {
  $imagesDir = Join-Path (Join-Path $SiteRoot $cat.Gallery) 'images'
  $subBlocks = New-Object System.Collections.Generic.List[string]

  if (-not (Test-Path -LiteralPath $imagesDir)) {
    Write-Warning "Folder not found: $imagesDir"
  } else {
    $known = @($cat.Subs | ForEach-Object { $_.Dir.ToLowerInvariant() })
    Get-ChildItem -LiteralPath $imagesDir -Directory | Where-Object { $known -notcontains $_.Name.ToLowerInvariant() } |
      ForEach-Object { Write-Warning "Folder not in `$Config, ignored: $($cat.Gallery)/images/$($_.Name)" }
  }

  foreach ($sub in $cat.Subs) {
    $dir = Join-Path $imagesDir $sub.Dir
    $portrait  = New-Object System.Collections.Generic.List[string]
    $landscape = New-Object System.Collections.Generic.List[string]

    if (Test-Path -LiteralPath $dir) {
      $files = Get-ChildItem -LiteralPath $dir -File |
        Where-Object { $Extensions -contains $_.Extension.ToLowerInvariant() } |
        Sort-Object -Property @{ Expression = {
            $n = 0
            if ([int]::TryParse([IO.Path]::GetFileNameWithoutExtension($_.Name), [ref]$n)) { $n } else { [int]::MaxValue }
          } }, Name

      foreach ($f in $files) {
        $rel  = ($f.FullName.Substring($SiteRoot.Length).TrimStart('\', '/')) -replace '\\', '/'
        $size = Get-ImageSize -Path $f.FullName
        if ($null -eq $size -or $size.W -le 0 -or $size.H -le 0) {
          $unreadable.Add($rel)
          continue
        }
        if ($size.H -gt $size.W) { $portrait.Add($rel) } else { $landscape.Add($rel) }
      }
    } else {
      Write-Warning "Folder not found: $dir"
    }

    $summary.Add([pscustomobject]@{
      Category  = $cat.Category
      SubCat    = $sub.Slug
      Portrait  = $portrait.Count
      Landscape = $landscape.Count
    })

    $pList = ($portrait  | ForEach-Object { '          ' + (ConvertTo-JsString $_) }) -join ",`n"
    $lList = ($landscape | ForEach-Object { '          ' + (ConvertTo-JsString $_) }) -join ",`n"
    $pBlock = if ($portrait.Count)  { "[`n$pList`n        ]" } else { '[]' }
    $lBlock = if ($landscape.Count) { "[`n$lList`n        ]" } else { '[]' }

    $subBlocks.Add("      $(ConvertTo-JsString $sub.Slug): {`n        `"portrait`": $pBlock,`n        `"landscape`": $lBlock`n      }")
  }

  $catBlocks.Add("    $(ConvertTo-JsString $cat.Category): {`n" + ($subBlocks -join ",`n") + "`n    }")
}

$stamp = Get-Date -Format 'yyyy-MM-dd HH:mm'
$js = @"
// Generated by Build-Portfolio-Manifest.ps1 on $stamp - do not edit by hand.
// Portrait images feed the #portfolio card slideshows; landscape images feed the nav preview.
window.PORTFOLIO_MANIFEST = {
  "generated": "$stamp",
  "categories": {
$($catBlocks -join ",`n")
  }
};
"@

$outPath = Join-Path $SiteRoot $OutFile
[IO.File]::WriteAllText($outPath, $js, (New-Object Text.UTF8Encoding $false))

# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------
Write-Host ''
Write-Host 'Portrait / landscape counts' -ForegroundColor Cyan
$summary | Format-Table Category, SubCat, Portrait, Landscape -AutoSize
$tp = ($summary | Measure-Object Portrait  -Sum).Sum
$tl = ($summary | Measure-Object Landscape -Sum).Sum
Write-Host "Total: $tp portrait, $tl landscape" -ForegroundColor Cyan

if ($unreadable.Count) {
  Write-Warning "$($unreadable.Count) file(s) could not be read and were skipped:"
  $unreadable | ForEach-Object { Write-Host "  $_" }
}

Write-Host ''
Write-Host "Wrote $outPath" -ForegroundColor Green
