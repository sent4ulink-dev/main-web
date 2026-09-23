# Local artwork

`wallpaper-photo.png` was generated specifically for Heart Desktop using the built-in image-generation tool. It is an original landscape, not a Microsoft wallpaper file.

Generation prompt: “Use case: photorealistic-natural. Create an original desktop wallpaper asset for a romantic early-2000s computer interface. Wide landscape 1536x1024. Saturated cobalt blue sky filling upper 60 percent, beautiful natural fluffy white cumulus clouds and a few wispy clouds, luminous rolling vivid green grass hills filling lower 40 percent. One soft hill crest from left middle sloping gently toward the right, with distant small blue ridges far right. Fine realistic grass texture, subtly scattered tiny flowers in foreground, midday sunlight, cheerful nostalgic consumer digital photography with rich colors. Natural photograph, not vector art or illustration. The center should be quiet and usable behind UI windows. No buildings, people, trees, roads, text, icons, logos, windows, interface, watermark or recognizable recreation of an existing famous wallpaper. Generate only the landscape. This will be used as a local website background, and cropped to mobile portrait.”

Icons and the pixel heart are original SVG geometry in the React source. The earlier `wallpaper.svg` is retained as an unused original asset.

Tiny5 is bundled through `@fontsource/tiny5` (SIL Open Font License, see `Tiny5-LICENSE.txt`). Source: https://github.com/Gissio/font_Tiny5. No font request goes to an external CDN at runtime.


## Updated desktop assets

`xp-startup.png` is the Windows XP startup reference image supplied by the user on 2026-09-09. Windows branding belongs to Microsoft.

`public/sounds/*.wav` are archived Microsoft Windows XP system sounds obtained from [MCPlayer2015/all-windows-sounds](https://github.com/MCPlayer2015/all-windows-sounds/tree/main/(2001)%20Windows%20XP). Microsoft owns the original audio. `sounds/sources.json` records the original names, URLs and Git blob hashes; these are archived recordings, not newly generated approximations. The game heart/celebration tones and built-in music melody remain original Web Audio synthesis.

The current interface requests locally installed Tahoma; Tiny5 is no longer imported. The silver media-player shell and animated canvas ribbon visualization are original code inspired by the supplied references.

## Messenger emoticons

The six glossy faces in `shared/emoticons.ts` are original SVG artwork inspired by early desktop messenger emoticons. They render locally and require no remote images or system emoji fonts.
