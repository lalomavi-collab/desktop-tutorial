-- Script: place in ServerScriptService.
-- Expects:
--   ReplicatedStorage.TackData (ModuleScript, see TackData.lua)
--   ReplicatedStorage.TackModels (Folder) holding one Model per item, each with a PrimaryPart
--   Workspace.Horses (Folder), each horse Model with Attachments named Head, Back, Neck
--   Tack rack parts tagged "TackRack" with a StringValue child "ItemId"
-- Pressing the prompt on a rack equips that item on the horse the player is nearest to.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local CollectionService = game:GetService("CollectionService")
local DataStoreService = game:GetService("DataStoreService")

local TackData = require(ReplicatedStorage:WaitForChild("TackData"))
local models = ReplicatedStorage:WaitForChild("TackModels")
local horses = workspace:WaitForChild("Horses")

local MAX_HORSE_DISTANCE = 15
local store = DataStoreService:GetDataStore("HorseTack_v1")

-- equipped[horse] = { [slot] = itemId }
local equipped = {}

local function nearestHorse(player)
	local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
	if not root then
		return nil
	end
	local best, bestDist = nil, MAX_HORSE_DISTANCE
	for _, horse in ipairs(horses:GetChildren()) do
		local pivot = horse:GetPivot().Position
		local d = (pivot - root.Position).Magnitude
		if d < bestDist then
			best, bestDist = horse, d
		end
	end
	return best
end

local function clearSlot(horse, slot)
	local old = horse:FindFirstChild("Tack_" .. slot)
	if old then
		old:Destroy()
	end
end

local function equip(horse, itemId, color)
	if not TackData.isValid(itemId) then
		return false
	end
	local item = TackData.Items[itemId]
	local template = models:FindFirstChild(item.ModelName)
	local attachment = horse:FindFirstChild(item.Slot, true)
	if not template or not attachment or not attachment:IsA("Attachment") then
		warn("Tack: missing model or attachment for", itemId)
		return false
	end

	clearSlot(horse, item.Slot)
	local clone = template:Clone()
	clone.Name = "Tack_" .. item.Slot
	clone:PivotTo(attachment.WorldCFrame)
	if typeof(color) == "Color3" then
		for _, d in ipairs(clone:GetDescendants()) do
			if d:IsA("BasePart") then
				d.Color = color
			end
		end
	end
	for _, d in ipairs(clone:GetDescendants()) do
		if d:IsA("BasePart") then
			d.Anchored = false
			d.CanCollide = false
		end
	end
	clone.Parent = horse

	local weld = Instance.new("WeldConstraint")
	weld.Part0 = attachment.Parent
	weld.Part1 = clone.PrimaryPart
	weld.Parent = clone.PrimaryPart

	equipped[horse] = equipped[horse] or {}
	equipped[horse][item.Slot] = itemId
	return true
end

local function save(horse)
	local ownerId = horse:GetAttribute("OwnerUserId")
	if not ownerId or not equipped[horse] then
		return
	end
	local ok, err = pcall(function()
		store:SetAsync(tostring(ownerId) .. "_" .. horse.Name, equipped[horse])
	end)
	if not ok then
		warn("Tack save failed:", err)
	end
end

local function load(horse)
	local ownerId = horse:GetAttribute("OwnerUserId")
	if not ownerId then
		return
	end
	local ok, data = pcall(function()
		return store:GetAsync(tostring(ownerId) .. "_" .. horse.Name)
	end)
	if ok and type(data) == "table" then
		for _, itemId in pairs(data) do
			equip(horse, itemId)
		end
	end
end

local function setupRack(rack)
	local idValue = rack:FindFirstChild("ItemId")
	if not idValue or not TackData.isValid(idValue.Value) then
		warn("Tack: bad rack", rack:GetFullName())
		return
	end
	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = "Equip " .. TackData.Items[idValue.Value].Name
	prompt.MaxActivationDistance = 8
	prompt.Parent = rack
	prompt.Triggered:Connect(function(player)
		local horse = nearestHorse(player)
		if horse and equip(horse, idValue.Value) then
			save(horse)
		end
	end)
end

for _, rack in ipairs(CollectionService:GetTagged("TackRack")) do
	setupRack(rack)
end
CollectionService:GetInstanceAddedSignal("TackRack"):Connect(setupRack)

for _, horse in ipairs(horses:GetChildren()) do
	task.spawn(load, horse)
end
horses.ChildAdded:Connect(function(horse)
	task.defer(load, horse)
end)
horses.ChildRemoved:Connect(function(horse)
	equipped[horse] = nil
end)

game:BindToClose(function()
	for horse in pairs(equipped) do
		save(horse)
	end
end)

-- Remote used by the customization UI: (itemId, optional Color3)
local remote = Instance.new("RemoteEvent")
remote.Name = "TackEquip"
remote.Parent = ReplicatedStorage

local lastUse = {}
remote.OnServerEvent:Connect(function(player, itemId, color)
	local now = os.clock()
	if lastUse[player] and now - lastUse[player] < 0.2 then
		return
	end
	lastUse[player] = now
	local horse = nearestHorse(player)
	if horse and equip(horse, itemId, color) then
		save(horse)
	end
end)
Players.PlayerRemoving:Connect(function(player)
	lastUse[player] = nil
end)
