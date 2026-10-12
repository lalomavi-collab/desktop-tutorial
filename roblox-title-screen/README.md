# Emmy: Roblox horse farm, setup

Sample Luau scripts. They were syntax checked only, never run in Roblox Studio.

## Place the scripts

| File | Where in Studio |
|---|---|
| `TitleScreen.client.lua` | StarterPlayer > StarterPlayerScripts |
| `tack/TackUI.client.lua` | StarterPlayer > StarterPlayerScripts |
| `tack/TackData.lua` | ReplicatedStorage (ModuleScript named `TackData`) |
| `tack/TackService.server.lua` | ServerScriptService |
| `tack/TestSetup.server.lua` | ServerScriptService (test horse and racks, delete when real assets exist) |
| `WorldBuilder.server.lua` | ServerScriptService (terrain, river with banks, stable, paddock, trees) |
| `HorseAI.server.lua` | ServerScriptService (horses wander in the paddock) |
| `SettingsUI.client.lua` | StarterPlayer > StarterPlayerScripts (the SETTINGS button opens it) |
| `LightingSetup.server.lua` | ServerScriptService (light, haze, day and night cycle) |
| `MaterialSetup.server.lua` | ServerScriptService (PBR textures on tagged parts) |

Script names must be unique per container. Scripts that wait for a folder (`TackModels`, `Horses`) need `TestSetup` to run, or your own folders.

## Manual steps in Studio

1. Lighting: set `Technology` to `Future`.
2. Game Settings > Security: enable API Services (needed for DataStore saves).
3. Upload the logo and paste its id into `CONFIG.LogoImageId` in `TitleScreen.client.lua`.
4. Test with Play, then publish.

## What still needs real assets

Realistic horses, tack, buildings and ground need 3D models and PBR textures. Code cannot produce them. Use assets you own or whose license allows it, and do not copy another game's assets.
