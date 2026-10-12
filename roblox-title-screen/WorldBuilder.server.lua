-- Script: place in ServerScriptService.
-- Builds the farm at runtime: rolling terrain, a river with sloping banks, a stable with six stalls,
-- a fenced paddock, a water trough, hay, trees and a spawn point. The flat zone around the origin
-- (where TestSetup puts the horse) stays at ground level y = 0.
-- Sample code, not a finished product: art quality depends on the assets you add later.

local CollectionService = game:GetService("CollectionService")
local Terrain = workspace.Terrain

local CELL = 8
local EXTENT = 200 -- world spans -EXTENT .. EXTENT
local FLAT_RADIUS = 110
local rng = Random.new(7)

local function riverZ(x)
	return 140 + 12 * math.sin(x / 35)
end

local function baseHeight(x, z)
	local r = math.sqrt(x * x + z * z)
	local blend = math.clamp((r - FLAT_RADIUS) / 60, 0, 1)
	blend = blend * blend * (3 - 2 * blend)
	return math.noise(x / 70, z / 70, 3) * 28 * blend
end

-- Terrain ----------------------------------------------------------------
local function buildTerrain()
	local count = 0
	for x = -EXTENT, EXTENT, CELL do
		for z = -EXTENT, EXTENT, CELL do
			local d = math.abs(z - riverZ(x))
			local h = baseHeight(x, z)
			local material = Enum.Material.Grass
			local bed = -4
			if d < 12 then
				h = bed
				material = Enum.Material.Sand
			elseif d < 24 then
				local t = (d - 12) / 12
				h = bed + (math.max(baseHeight(x, z), 1) - bed) * t
				material = t < 0.5 and Enum.Material.Mud or Enum.Material.Ground
			end
			local height = h + 40
			Terrain:FillBlock(CFrame.new(x, (h - 40) / 2, z), Vector3.new(CELL, height, CELL), material)
			if d < 12 then
				Terrain:FillBlock(CFrame.new(x, bed + 1.5, z), Vector3.new(CELL, 3, CELL), Enum.Material.Water)
			end
			count = count + 1
			if count % 200 == 0 then
				task.wait()
			end
		end
	end
end

-- Helpers ----------------------------------------------------------------
local world = Instance.new("Folder")
world.Name = "FarmWorld"
world.Parent = workspace

local function part(name, size, pos, color, material, parent)
	local p = Instance.new("Part")
	p.Name = name
	p.Size = size
	p.Position = pos
	p.Color = color
	p.Material = material or Enum.Material.Wood
	p.Anchored = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Parent = parent or world
	return p
end

local WOOD = Color3.fromRGB(176, 128, 78)
local DARK_WOOD = Color3.fromRGB(110, 76, 46)

local function fenceLine(a, b, parent)
	local dir = b - a
	local len = dir.Magnitude
	local mid = (a + b) / 2
	local cf = CFrame.lookAt(mid, b)
	for _, y in ipairs({ 2, 3.6 }) do
		local rail = part("Rail", Vector3.new(0.4, 0.5, len), mid + Vector3.new(0, y, 0), WOOD, Enum.Material.Wood, parent)
		rail.CFrame = cf * CFrame.new(0, y, 0)
	end
	local posts = math.max(math.floor(len / 6), 1)
	for i = 0, posts do
		local pos = a + dir * (i / posts)
		part("Post", Vector3.new(0.7, 4.5, 0.7), pos + Vector3.new(0, 2.25, 0), DARK_WOOD, Enum.Material.Wood, parent)
	end
end

-- Paddock ----------------------------------------------------------------
local function buildPaddock()
	local f = Instance.new("Folder")
	f.Name = "Paddock"
	f.Parent = world
	local s = 40
	local corners = {
		Vector3.new(-s, 0, -s), Vector3.new(s, 0, -s), Vector3.new(s, 0, s), Vector3.new(-s, 0, s),
	}
	for i = 1, 4 do
		local a, b = corners[i], corners[i % 4 + 1]
		-- leave a 10 stud gate gap in the south side
		if i == 1 then
			fenceLine(a, a + (b - a) * 0.4, f)
			fenceLine(a + (b - a) * 0.6, b, f)
		else
			fenceLine(a, b, f)
		end
	end
	-- water trough
	part("Trough", Vector3.new(8, 1.6, 2.4), Vector3.new(-30, 0.8, 30), Color3.fromRGB(120, 120, 125), Enum.Material.Metal, f)
	local water = part("TroughWater", Vector3.new(7.4, 0.2, 1.8), Vector3.new(-30, 1.5, 30), Color3.fromRGB(70, 130, 200), Enum.Material.Glass, f)
	water.Transparency = 0.4
	CollectionService:AddTag(water, "WaterStation")
	-- hay bales
	for i = 1, 3 do
		local bale = part("Hay", Vector3.new(4, 2.4, 2.4), Vector3.new(30 - i * 0.5, 1.2, 28 - i * 3.2), Color3.fromRGB(214, 183, 92), Enum.Material.Fabric, f)
		CollectionService:AddTag(bale, "HayStation")
	end
end

-- Stable -----------------------------------------------------------------
local function buildStable()
	local f = Instance.new("Folder")
	f.Name = "Stable"
	f.Parent = world
	local c = Vector3.new(0, 0, -75) -- center of the stable floor
	local W, L, H = 26, 40, 12

	part("Floor", Vector3.new(W, 0.4, L), c + Vector3.new(0, 0.2, 0), Color3.fromRGB(70, 70, 76), Enum.Material.Slate, f)
	-- back wall and side walls (front stays open at the aisle)
	part("BackWall", Vector3.new(W, H, 0.6), c + Vector3.new(0, H / 2, -L / 2), WOOD, Enum.Material.Wood, f)
	part("LeftWall", Vector3.new(0.6, H, L), c + Vector3.new(-W / 2, H / 2, 0), WOOD, Enum.Material.Wood, f)
	part("RightWall", Vector3.new(0.6, H, L), c + Vector3.new(W / 2, H / 2, 0), WOOD, Enum.Material.Wood, f)
	-- gabled roof from two tilted slabs
	for _, side in ipairs({ -1, 1 }) do
		local roof = part("Roof", Vector3.new(W / 2 + 2, 0.6, L + 2), c + Vector3.new(side * W / 4, H + 2, 0), Color3.fromRGB(90, 55, 45), Enum.Material.Wood, f)
		roof.CFrame = CFrame.new(roof.Position) * CFrame.Angles(0, 0, math.rad(-side * 18))
	end

	-- six stalls, three per side, each with a name sign
	local names = { "Emmy", "Bella", "Storm", "Luna", "Shadow", "Daisy" }
	local idx = 0
	for _, side in ipairs({ -1, 1 }) do
		for row = 0, 2 do
			idx = idx + 1
			local z = -L / 2 + 6 + row * 11
			part("Divider", Vector3.new(10, 6, 0.4), c + Vector3.new(side * 8, 3, z - 5.5), WOOD, Enum.Material.Wood, f)
			part("StallFront", Vector3.new(0.4, 6, 10), c + Vector3.new(side * 3, 3, z), DARK_WOOD, Enum.Material.Wood, f).Transparency = 0.15
			local sign = part("Sign" .. idx, Vector3.new(0.2, 1.2, 3), c + Vector3.new(side * 2.8, 6.6, z), Color3.fromRGB(235, 220, 190), Enum.Material.Wood, f)
			local gui = Instance.new("SurfaceGui")
			gui.Face = side == -1 and Enum.NormalId.Right or Enum.NormalId.Left
			gui.Parent = sign
			local label = Instance.new("TextLabel")
			label.Size = UDim2.fromScale(1, 1)
			label.BackgroundTransparency = 1
			label.Text = names[idx]
			label.Font = Enum.Font.Garamond
			label.TextScaled = true
			label.TextColor3 = Color3.fromRGB(60, 40, 20)
			label.Parent = gui
			-- straw bedding
			part("Straw", Vector3.new(8, 0.3, 9), c + Vector3.new(side * 8, 0.55, z), Color3.fromRGB(222, 196, 110), Enum.Material.Fabric, f)
		end
	end
	-- tack room and riders room behind the aisle
	part("TackRoomWall", Vector3.new(W - 2, 8, 0.4), c + Vector3.new(0, 4, -L / 2 + 3), DARK_WOOD, Enum.Material.Wood, f).Transparency = 0.2
end

-- Trees ------------------------------------------------------------------
local function buildTrees()
	local f = Instance.new("Folder")
	f.Name = "Trees"
	f.Parent = world
	local placed = 0
	while placed < 60 do
		local x = rng:NextInteger(-EXTENT + 10, EXTENT - 10)
		local z = rng:NextInteger(-EXTENT + 10, EXTENT - 10)
		local inPaddock = math.abs(x) < 50 and math.abs(z) < 50
		local inStable = math.abs(x) < 25 and z > -105 and z < -45
		local nearRiver = math.abs(z - riverZ(x)) < 30
		if not (inPaddock or inStable or nearRiver) then
			local ground = baseHeight(x, z)
			local h = rng:NextNumber(14, 24)
			part("Trunk", Vector3.new(2, h, 2), Vector3.new(x, ground + h / 2, z), Color3.fromRGB(90, 62, 40), Enum.Material.Wood, f).Shape = Enum.PartType.Cylinder
			local crown = part("Crown", Vector3.new(h * 0.9, h * 0.8, h * 0.9), Vector3.new(x, ground + h + 2, z), Color3.fromRGB(56, 110, 52), Enum.Material.Grass, f)
			crown.Shape = Enum.PartType.Ball
			placed = placed + 1
		end
	end
end

-- Spawn ------------------------------------------------------------------
local function buildSpawn()
	local spawn = Instance.new("SpawnLocation")
	spawn.Position = Vector3.new(0, 0.6, -50)
	spawn.Size = Vector3.new(6, 1, 6)
	spawn.Anchored = true
	spawn.Transparency = 1
	spawn.CanCollide = false
	spawn.Parent = world
end

buildSpawn()
buildPaddock()
buildStable()
buildTerrain()
buildTrees()
