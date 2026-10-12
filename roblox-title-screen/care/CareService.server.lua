-- Script: place in ServerScriptService.
-- Horse care: each horse in Workspace.Horses has Hunger, Thirst and Cleanliness attributes (0 to 100)
-- that slowly decay. Players restore them at stations:
--   parts tagged "HayStation" feed, "WaterStation" give water, and a Brush prompt on the horse cleans it.
-- Values are saved per horse when it has an OwnerUserId attribute. Sample code, not a finished product.

local CollectionService = game:GetService("CollectionService")
local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")

local horses = workspace:WaitForChild("Horses")
local store = DataStoreService:GetDataStore("HorseCare_v1")

local STATS = { "Hunger", "Thirst", "Cleanliness" }
local DECAY_PER_TICK = { Hunger = 1.0, Thirst = 1.5, Cleanliness = 0.5 }
local TICK = 10 -- seconds
local RESTORE = 35
local MAX_DISTANCE = 15

local function key(horse)
	local owner = horse:GetAttribute("OwnerUserId")
	return owner and (tostring(owner) .. "_" .. horse.Name) or nil
end

local function setupHorse(horse)
	for _, stat in ipairs(STATS) do
		horse:SetAttribute(stat, 100)
	end
	local k = key(horse)
	if k then
		local ok, data = pcall(function()
			return store:GetAsync(k)
		end)
		if ok and type(data) == "table" then
			for _, stat in ipairs(STATS) do
				if type(data[stat]) == "number" then
					horse:SetAttribute(stat, math.clamp(data[stat], 0, 100))
				end
			end
		end
	end

	-- brush prompt on the horse body
	local body = horse.PrimaryPart
	if body and not body:FindFirstChild("BrushPrompt") then
		local prompt = Instance.new("ProximityPrompt")
		prompt.Name = "BrushPrompt"
		prompt.ActionText = "Brush"
		prompt.ObjectText = horse.Name
		prompt.MaxActivationDistance = 8
		prompt.Parent = body
		prompt.Triggered:Connect(function()
			horse:SetAttribute("Cleanliness", math.min(100, horse:GetAttribute("Cleanliness") + RESTORE))
		end)
	end
end

local function save(horse)
	local k = key(horse)
	if not k then
		return
	end
	local data = {}
	for _, stat in ipairs(STATS) do
		data[stat] = horse:GetAttribute(stat)
	end
	pcall(function()
		store:SetAsync(k, data)
	end)
end

local function nearestHorse(player)
	local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
	if not root then
		return nil
	end
	local best, bestDist = nil, MAX_DISTANCE
	for _, horse in ipairs(horses:GetChildren()) do
		local d = (horse:GetPivot().Position - root.Position).Magnitude
		if d < bestDist then
			best, bestDist = horse, d
		end
	end
	return best
end

local function setupStation(part, stat, label)
	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = label
	prompt.MaxActivationDistance = 8
	prompt.Parent = part
	prompt.Triggered:Connect(function(player)
		local horse = nearestHorse(player)
		if horse then
			horse:SetAttribute(stat, math.min(100, (horse:GetAttribute(stat) or 0) + RESTORE))
			save(horse)
		end
	end)
end

for _, p in ipairs(CollectionService:GetTagged("HayStation")) do
	setupStation(p, "Hunger", "Feed hay")
end
for _, p in ipairs(CollectionService:GetTagged("WaterStation")) do
	setupStation(p, "Thirst", "Give water")
end
CollectionService:GetInstanceAddedSignal("HayStation"):Connect(function(p)
	setupStation(p, "Hunger", "Feed hay")
end)
CollectionService:GetInstanceAddedSignal("WaterStation"):Connect(function(p)
	setupStation(p, "Thirst", "Give water")
end)

for _, h in ipairs(horses:GetChildren()) do
	task.spawn(setupHorse, h)
end
horses.ChildAdded:Connect(function(h)
	task.defer(setupHorse, h)
end)

task.spawn(function()
	while true do
		task.wait(TICK)
		for _, horse in ipairs(horses:GetChildren()) do
			for _, stat in ipairs(STATS) do
				local v = horse:GetAttribute(stat)
				if v then
					horse:SetAttribute(stat, math.max(0, v - DECAY_PER_TICK[stat]))
				end
			end
		end
	end
end)

game:BindToClose(function()
	for _, horse in ipairs(horses:GetChildren()) do
		save(horse)
	end
end)
