-- Script: place in ServerScriptService.
-- Saves each player's settings (effects, shadows, field of view). The client asks for them on join
-- and sends changes. Values are validated here, never trusted from the client.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local DataStoreService = game:GetService("DataStoreService")

local store = DataStoreService:GetDataStore("PlayerSettings_v1")
local DEFAULTS = { effects = true, shadows = true, fov = 70 }
local cache = {}

local function clean(raw)
	local s = {}
	s.effects = type(raw.effects) == "boolean" and raw.effects or DEFAULTS.effects
	s.shadows = type(raw.shadows) == "boolean" and raw.shadows or DEFAULTS.shadows
	s.fov = type(raw.fov) == "number" and math.clamp(raw.fov, 50, 90) or DEFAULTS.fov
	return s
end

local getFn = Instance.new("RemoteFunction")
getFn.Name = "GetSettings"
getFn.Parent = ReplicatedStorage

local setEvent = Instance.new("RemoteEvent")
setEvent.Name = "SetSettings"
setEvent.Parent = ReplicatedStorage

local function load(player)
	if cache[player] then
		return cache[player]
	end
	local ok, data = pcall(function()
		return store:GetAsync(tostring(player.UserId))
	end)
	cache[player] = clean(ok and type(data) == "table" and data or {})
	return cache[player]
end

getFn.OnServerInvoke = function(player)
	return load(player)
end

setEvent.OnServerEvent:Connect(function(player, raw)
	if type(raw) == "table" then
		cache[player] = clean(raw)
	end
end)

Players.PlayerRemoving:Connect(function(player)
	local s = cache[player]
	if s then
		pcall(function()
			store:SetAsync(tostring(player.UserId), s)
		end)
	end
	cache[player] = nil
end)

game:BindToClose(function()
	for player, s in pairs(cache) do
		pcall(function()
			store:SetAsync(tostring(player.UserId), s)
		end)
	end
end)
