-- LocalScript: place in StarterPlayer > StarterPlayerScripts.
-- Shows Hunger, Thirst and Cleanliness bars for the nearest horse (within 20 studs).

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local player = Players.LocalPlayer
local horses = workspace:WaitForChild("Horses")

local gui = Instance.new("ScreenGui")
gui.Name = "CareHUD"
gui.ResetOnSpawn = false
gui.Enabled = false
gui.Parent = player:WaitForChild("PlayerGui")

local panel = Instance.new("Frame")
panel.AnchorPoint = Vector2.new(0, 1)
panel.Position = UDim2.new(0, 20, 1, -90)
panel.Size = UDim2.fromOffset(220, 120)
panel.BackgroundColor3 = Color3.fromRGB(35, 35, 40)
panel.BackgroundTransparency = 0.2
panel.Parent = gui
Instance.new("UICorner", panel).CornerRadius = UDim.new(0, 12)

local title = Instance.new("TextLabel")
title.Size = UDim2.new(1, 0, 0, 26)
title.BackgroundTransparency = 1
title.Font = Enum.Font.GothamBold
title.TextSize = 16
title.TextColor3 = Color3.new(1, 1, 1)
title.Parent = panel

local COLORS = {
	Hunger = Color3.fromRGB(214, 170, 60),
	Thirst = Color3.fromRGB(70, 140, 220),
	Cleanliness = Color3.fromRGB(110, 190, 120),
}
local fills = {}
for i, stat in ipairs({ "Hunger", "Thirst", "Cleanliness" }) do
	local y = 30 + (i - 1) * 28
	local label = Instance.new("TextLabel")
	label.Position = UDim2.fromOffset(10, y)
	label.Size = UDim2.fromOffset(80, 20)
	label.BackgroundTransparency = 1
	label.Font = Enum.Font.Gotham
	label.TextSize = 13
	label.TextXAlignment = Enum.TextXAlignment.Left
	label.TextColor3 = Color3.new(1, 1, 1)
	label.Text = stat
	label.Parent = panel
	local bar = Instance.new("Frame")
	bar.Position = UDim2.fromOffset(95, y + 5)
	bar.Size = UDim2.fromOffset(115, 10)
	bar.BackgroundColor3 = Color3.fromRGB(70, 70, 78)
	bar.Parent = panel
	local fill = Instance.new("Frame")
	fill.Size = UDim2.fromScale(1, 1)
	fill.BackgroundColor3 = COLORS[stat]
	fill.BorderSizePixel = 0
	fill.Parent = bar
	fills[stat] = fill
end

local accum = 0
RunService.Heartbeat:Connect(function(dt)
	accum = accum + dt
	if accum < 0.25 then
		return
	end
	accum = 0
	local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
	local best, bestDist = nil, 20
	if root then
		for _, horse in ipairs(horses:GetChildren()) do
			local d = (horse:GetPivot().Position - root.Position).Magnitude
			if d < bestDist then
				best, bestDist = horse, d
			end
		end
	end
	gui.Enabled = best ~= nil
	if best then
		title.Text = best.Name
		for stat, fill in pairs(fills) do
			fill.Size = UDim2.fromScale(math.clamp((best:GetAttribute(stat) or 0) / 100, 0, 1), 1)
		end
	end
end)
