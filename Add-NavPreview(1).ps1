<#
.SYNOPSIS
  Adds the shared nav-preview feature (portfolio-images.js) to the pages of the website.

.DESCRIPTION
  Put this file in the site root (next to index.html), together with:
      portfolio-images.js
      portfolio-manifest.js        (made by Build-Portfolio-Manifest.ps1)

  Then run a dry run first - it only reports, it changes nothing:
      powershell -ExecutionPolicy Bypass -File .\Add-NavPreview.ps1 -DryRun

  and when the report looks right, run it for real:
      powershell -ExecutionPolicy Bypass -File .\Add-NavPreview.ps1

  For every page it can handle it will:
    1. copy the original into a backup folder  (nav-preview-backup-<date-time>\...)
    2. add the two <script> tags before the page's nav script
       (root pages use data-root="", pages in *-gallery folders use "../")
    3. remove the page's old hover-slideshow code so it doesn't fight the new file

  A page is only written if every check passes. Anything it doesn't recognise is skipped and
  listed at the end with the reason - a skipped page is never half-edited.
  Pages that already contain portfolio-images.js are skipped, so running it twice is safe.
#>
[CmdletBinding()]
param(
  [string]$SiteRoot = $PSScriptRoot,
  [switch]$DryRun,
  [string[]]$Exclude = @('index2.html')     # paths relative to the site root, e.g. 'booking.html'
)

$ErrorActionPreference = 'Stop'
if (-not $SiteRoot) { $SiteRoot = (Get-Location).Path }
$SiteRoot = (Resolve-Path -LiteralPath $SiteRoot).Path.TrimEnd('\', '/')

$GalleryFolders = @('corporate-gallery', 'events-gallery', 'lifestyle-gallery')

# Words that must be gone from the nav script once the old preview code is removed
$Leftovers = @('resetPreview', 'startSlideshow', 'stopSlideshow', 'preloadAll', 'resolveSlide', 'ddImgs', 'LOGO_SRC')

foreach ($f in 'portfolio-images.js', 'portfolio-manifest.js') {
  if (-not (Test-Path -LiteralPath (Join-Path $SiteRoot $f))) {
    throw "$f not found in $SiteRoot - put it in the site root first (run Build-Portfolio-Manifest.ps1 for the manifest)."
  }
}

# ---------------------------------------------------------------------------
# Returns an object with .Text (new page text) or .Reason (why it was skipped)
# ---------------------------------------------------------------------------
function Update-NavPage {
  param([string]$Text, [string]$Root)

  if ($Text.Contains('portfolio-images.js')) {
    return [pscustomobject]@{ Text = $null; Reason = 'already done' }
  }
  foreach ($need in 'id="navDdImgB"', 'data-group=', 'id="portfolioDropdownBtn"') {
    if (-not $Text.Contains($need)) {
      return [pscustomobject]@{ Text = $null; Reason = "older nav (missing $need) - its nav has to be replaced first" }
    }
  }

  $crlf  = $Text.Contains("`r`n")
  $lines = [string[]]($Text -split "`n")

  # --- find the nav <script> ... </script> ---
  $ib = -1
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i].Contains("getElementById('portfolioDropdownBtn')")) { $ib = $i; break }
  }
  if ($ib -lt 0) { return [pscustomobject]@{ Text = $null; Reason = 'nav script not found' } }

  $s = -1
  for ($i = $ib; $i -ge 0; $i--) { if ($lines[$i].Trim() -eq '<script>') { $s = $i; break } }
  $e = -1
  for ($i = $ib; $i -lt $lines.Count; $i++) { if ($lines[$i].Trim() -eq '</script>') { $e = $i; break } }
  if ($s -lt 1 -or $e -lt 0 -or $e -ge ($lines.Count - 1)) {
    return [pscustomobject]@{ Text = $null; Reason = 'nav script boundaries not found' }
  }

  $reg = @($lines[$s..$e])

  # --- old preview block: from "desktop (hover) slideshow" comment to the linksEl mouseleave line ---
  $a = -1
  for ($i = 0; $i -lt $reg.Count; $i++) {
    if ($reg[$i] -match '/\* -+ desktop (hover )?slideshow') { $a = $i; break }
  }
  if ($a -lt 1) { return [pscustomobject]@{ Text = $null; Reason = 'old preview block start not found' } }

  $b = -1
  for ($i = $a; $i -lt $reg.Count; $i++) {
    if ($reg[$i].Contains("linksEl.addEventListener('mouseleave'")) { $b = $i; break }
  }
  if ($b -lt 0 -or $b -ge ($reg.Count - 1)) {
    return [pscustomobject]@{ Text = $null; Reason = 'old preview block end not found' }
  }

  # keep the two sizing helpers if they were inside the block (they are used by positionDropdown)
  $keep = @($reg[$a..$b] | Where-Object { $_.Contains('const TABLET_MAX') -or $_.Contains('const isDesktop') })
  $reg  = @($reg[0..($a - 1)]) + $keep + @($reg[($b + 1)..($reg.Count - 1)])

  # --- tidy the leftovers of the old code ---
  $out = New-Object System.Collections.Generic.List[string]
  foreach ($l in $reg) {
    $t = $l.Trim()
    if ($t.Contains('startSlideshow(')) { continue }
    if ($t.StartsWith('const slugs') -or $t.StartsWith('const cover')) { continue }
    if ($t -eq 'resetPreview();') { continue }
    if ($t.Contains("getElementById('navDdCaption')")) { continue }
    $l = $l.Replace('if (isOpen) positionDropdown(); else resetPreview();', 'if (isOpen) positionDropdown();')
    $l = $l.Replace('if (isOpen) { positionDropdown(); if (isDesktop()) preloadAll(); } else { resetPreview(); }', 'if (isOpen) { positionDropdown(); }')
    $l = $l.Replace('if (isOpen) { positionDropdown(); } else { resetPreview(); }', 'if (isOpen) { positionDropdown(); }')
    $out.Add($l)
  }

  # --- safety checks before anything is written ---
  $joined = $out -join "`n"
  $left = @($Leftovers | Where-Object { $joined.Contains($_) })
  if ($left.Count) {
    return [pscustomobject]@{ Text = $null; Reason = 'old code still referenced after edit: ' + ($left -join ', ') }
  }
  if ($joined.Contains('isDesktop') -and -not $joined.Contains('const isDesktop')) {
    return [pscustomobject]@{ Text = $null; Reason = 'isDesktop definition missing after edit' }
  }

  # --- assemble ---
  $cr  = if ($crlf) { "`r" } else { '' }
  $ins = @(
    "  <script src=`"${Root}portfolio-manifest.js`"></script>$cr",
    "  <script src=`"${Root}portfolio-images.js`" data-root=`"$Root`"></script>$cr",
    "$cr"
  )
  $result = @($lines[0..($s - 1)]) + $ins + @($out) + @($lines[($e + 1)..($lines.Count - 1)])
  return [pscustomobject]@{ Text = ($result -join "`n"); Reason = $null }
}

# ---------------------------------------------------------------------------
# Collect pages: root *.html  +  *.html directly inside the three gallery folders
# ---------------------------------------------------------------------------
$targets = New-Object System.Collections.Generic.List[object]
Get-ChildItem -LiteralPath $SiteRoot -Filter '*.html' -File | ForEach-Object {
  $targets.Add([pscustomobject]@{ File = $_; Root = '' })
}
foreach ($g in $GalleryFolders) {
  $d = Join-Path $SiteRoot $g
  if (Test-Path -LiteralPath $d) {
    Get-ChildItem -LiteralPath $d -Filter '*.html' -File | ForEach-Object {
      $targets.Add([pscustomobject]@{ File = $_; Root = '../' })
    }
  } else {
    Write-Warning "Folder not found: $g"
  }
}

$backupDir = Join-Path $SiteRoot ('nav-preview-backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
$changed = New-Object System.Collections.Generic.List[string]
$skipped = New-Object System.Collections.Generic.List[string]

foreach ($t in $targets) {
  $path = $t.File.FullName
  $rel  = ($path.Substring($SiteRoot.Length).TrimStart('\', '/')) -replace '\\', '/'

  if ($Exclude -contains $rel) { $skipped.Add("$rel  -  excluded"); continue }

  # read (remember BOM so the file keeps its encoding)
  $bytes  = [IO.File]::ReadAllBytes($path)
  $hasBom = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
  $off    = if ($hasBom) { 3 } else { 0 }
  $text   = (New-Object Text.UTF8Encoding $false).GetString($bytes, $off, $bytes.Length - $off)

  $res = Update-NavPage -Text $text -Root $t.Root
  if ($null -eq $res.Text) { $skipped.Add("$rel  -  $($res.Reason)"); continue }

  if (-not $DryRun) {
    $dest = Join-Path $backupDir ($rel -replace '/', '\')
    New-Item -ItemType Directory -Force -Path (Split-Path $dest -Parent) | Out-Null
    Copy-Item -LiteralPath $path -Destination $dest
    [IO.File]::WriteAllText($path, $res.Text, (New-Object Text.UTF8Encoding $hasBom))
  }
  $changed.Add("$rel  (data-root=`"$($t.Root)`")")
}

# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------
Write-Host ''
if ($DryRun) { Write-Host 'DRY RUN - nothing was changed' -ForegroundColor Yellow }
Write-Host ("Pages that {0}: {1}" -f $(if ($DryRun) { 'would be updated' } else { 'were updated' }), $changed.Count) -ForegroundColor Green
$changed | ForEach-Object { Write-Host "  + $_" }
Write-Host ''
Write-Host "Pages skipped: $($skipped.Count)" -ForegroundColor Cyan
$skipped | ForEach-Object { Write-Host "  - $_" }
if (-not $DryRun -and $changed.Count) {
  Write-Host ''
  Write-Host "Originals backed up in: $backupDir" -ForegroundColor Green
}
