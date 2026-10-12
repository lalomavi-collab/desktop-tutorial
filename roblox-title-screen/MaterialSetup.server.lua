-- Script: place in ServerScriptService.
-- Gives tagged parts a realistic PBR material through SurfaceAppearance.
-- Tag a part (CollectionService tag from the Tag Editor) with one of the names in PRESETS.
-- Fill in the texture ids with textures you own or are licensed to use. Empty ids are skipped.

local CollectionService = game:GetService("CollectionService")

local PRESETS = {
	StableWood = { ColorMap = "", NormalMap = "", RoughnessMap = "", MetalnessMap = "" },
	StoneFloor = { ColorMap = "", NormalMap = "", RoughnessMap = "", MetalnessMap = "" },
	Hay = { ColorMap = "", NormalMap = "", RoughnessMap = "", MetalnessMap = "" },
}

local function apply(part, presetName)
	local maps = PRESETS[presetName]
	if not maps or not part:IsA("MeshPart") then
		return
	end
	local sa = part:FindFirstChildOfClass("SurfaceAppearance") or Instance.new("SurfaceAppearance")
	for prop, id in pairs(maps) do
		if id ~= "" then
			sa[prop] = id
		end
	end
	sa.Parent = part
end

for presetName in pairs(PRESETS) do
	for _, part in ipairs(CollectionService:GetTagged(presetName)) do
		apply(part, presetName)
	end
	CollectionService:GetInstanceAddedSignal(presetName):Connect(function(part)
		apply(part, presetName)
	end)
end
