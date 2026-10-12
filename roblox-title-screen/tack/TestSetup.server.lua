-- Script: place in ServerScriptService, next to TackService.
-- Builds a placeholder block horse, placeholder tack models and five racks at runtime,
-- so the tack system can be tested without any art assets. Delete this script when real assets exist.
-- The test horse has no OwnerUserId attribute, so nothing is saved to the DataStore.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local CollectionService = game:GetService("CollectionService")

local TackData = require(ReplicatedStorage:WaitForChild("TackData"))

local ORIGIN = Vector3.new(0, 0, 0) -- change to place the test area

local function part(name, size, cframe, color, parent)
	local p = Instance.new("Part")
	p.Name = name
	p.Size = size
	p.CFrame = cframe
	p.Color = color
	p.Material = Enum.Material.SmoothPlastic
	p.Anchored = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Parent = parent
	return p
end

local function attach(parent, name, offset)
	local a = Instance.new("Attachment")
	a.Name = name
	a.Position = offset
	a.Parent = parent
	return a
end

-- Horse: body, neck, head, four legs, tail. Faces the +Z direction.
local function buildHorse()
	local horse = Instance.new("Model")
	horse.Name = "TestHorse"
	local brown = Color3.fromRGB(139, 90, 60)
	local dark = Color3.fromRGB(70, 45, 30)
	local base = CFrame.new(ORIGIN + Vector3.new(0, 0, 0))

	local body = part("Body", Vector3.new(2, 2, 5), base * CFrame.new(0, 4, 0), brown, horse)
	local neck = part("Neck", Vector3.new(1, 2.5, 1), base * CFrame.new(0, 5.8, 3) * CFrame.Angles(math.rad(-25), 0, 0), brown, horse)
	local head = part("Head", Vector3.new(1, 1, 2), base * CFrame.new(0, 7.1, 4) * CFrame.Angles(math.rad(20), 0, 0), brown, horse)
	part("Tail", Vector3.new(0.4, 2, 0.4), base * CFrame.new(0, 3.5, -2.8) * CFrame.Angles(math.rad(15), 0, 0), dark, horse)
	for i, pos in ipairs({ Vector3.new(-0.7, 1.5, 2), Vector3.new(0.7, 1.5, 2), Vector3.new(-0.7, 1.5, -2), Vector3.new(0.7, 1.5, -2) }) do
		part("Leg" .. i, Vector3.new(0.6, 3, 0.6), base * CFrame.new(pos), dark, horse)
	end

	attach(head, "Head", Vector3.new(0, 0, 0))
	attach(body, "Back", Vector3.new(0, 1, 0))
	attach(neck, "Neck", Vector3.new(0, 0, 0))

	horse.PrimaryPart = body
	return horse
end

-- Tack: one small colored block model per catalog item
local TACK_LOOK = {
	Halter = { Vector3.new(1.2, 0.3, 2.2), Color3.fromRGB(200, 40, 40) },
	Bridle = { Vector3.new(1.3, 0.4, 2.4), Color3.fromRGB(30, 30, 30) },
	Saddle = { Vector3.new(1.8, 0.5, 2), Color3.fromRGB(100, 50, 20) },
	Blanket = { Vector3.new(2.2, 0.2, 2.6), Color3.fromRGB(40, 120, 200) },
	LeadRope = { Vector3.new(0.2, 0.2, 3), Color3.fromRGB(240, 220, 60) },
}

local function buildTackModels()
	local folder = Instance.new("Folder")
	folder.Name = "TackModels"
	for itemId, item in pairs(TackData.Items) do
		local look = TACK_LOOK[itemId]
		if look then
			local m = Instance.new("Model")
			m.Name = item.ModelName
			local p = part("Main", look[1], CFrame.new(), look[2], m)
			p.CanCollide = false
			p.Massless = true
			m.PrimaryPart = p
			m.Parent = folder
		end
	end
	folder.Parent = ReplicatedStorage
end

-- Racks: a post in a row beside the horse, tagged for TackService
local function buildRacks()
	local i = 0
	for itemId, item in pairs(TackData.Items) do
		local look = TACK_LOOK[itemId]
		if look then
			i = i + 1
			local rack = part("Rack_" .. itemId, Vector3.new(2, 4, 1), CFrame.new(ORIGIN + Vector3.new(8, 2, -6 + i * 3)), look[2], workspace)
			local id = Instance.new("StringValue")
			id.Name = "ItemId"
			id.Value = itemId
			id.Parent = rack
			rack:SetAttribute("Label", item.Name)
			CollectionService:AddTag(rack, "TackRack") -- tag last, after ItemId exists
		end
	end
end

buildTackModels()
local horses = Instance.new("Folder")
horses.Name = "Horses"
buildHorse().Parent = horses
horses.Parent = workspace
buildRacks()
