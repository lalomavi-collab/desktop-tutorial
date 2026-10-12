-- LocalScript: place in StarterPlayer > StarterPlayerScripts.
-- Creates the ScreenGui named "SettingsGui" that the SETTINGS button on the title screen toggles.
-- Options: visual effects on/off, shadows on/off, field of view. Changes are local to the player.
-- They reset on rejoin: saving them needs a server side DataStore, not built yet.

local Players = game:GetService("Players")
local Lighting = game:GetService("Lighting")
local UserInputService = game:GetService("UserInputService")

local gui = Instance.new("ScreenGui")
gui.Name = "SettingsGui"
gui.ResetOnSpawn = false
gui.Enabled = false
gui.DisplayOrder = 110
gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")

local function make(class, props, parent)
	local o = Instance.new(class)
	for k, v in pairs(props) do
		o[k] = v
	end
	o.Parent = parent
	return o
end

local panel = make("Frame", {
	AnchorPoint = Vector2.new(0.5, 0.5),
	Position = UDim2.fromScale(0.5, 0.5),
	Size = UDim2.fromOffset(340, 300),
	BackgroundColor3 = Color3.fromRGB(35, 35, 40),
}, gui)
make("UICorner", { CornerRadius = UDim.new(0, 14) }, panel)

make("TextLabel", {
	Size = UDim2.new(1, 0, 0, 50),
	BackgroundTransparency = 1,
	Text = "SETTINGS",
	Font = Enum.Font.GothamBold,
	TextSize = 24,
	TextColor3 = Color3.new(1, 1, 1),
}, panel)

local function toggle(label, y, initial, onChange)
	local on = initial
	local b = make("TextButton", {
		Position = UDim2.fromOffset(20, y),
		Size = UDim2.new(1, -40, 0, 38),
		BackgroundColor3 = Color3.fromRGB(60, 60, 68),
		Font = Enum.Font.GothamBold,
		TextSize = 16,
		TextColor3 = Color3.new(1, 1, 1),
	}, panel)
	make("UICorner", { CornerRadius = UDim.new(0, 10) }, b)
	local function refresh()
		b.Text = label .. ": " .. (on and "ON" or "OFF")
	end
	refresh()
	b.Activated:Connect(function()
		on = not on
		refresh()
		onChange(on)
	end)
end

toggle("Visual effects", 60, true, function(on)
	for _, e in ipairs(Lighting:GetChildren()) do
		if e:IsA("PostEffect") then
			e.Enabled = on
		end
	end
end)

toggle("Shadows", 108, Lighting.GlobalShadows, function(on)
	Lighting.GlobalShadows = on
end)

-- Field of view slider, 50 to 90
local camera = workspace.CurrentCamera
make("TextLabel", {
	Position = UDim2.fromOffset(20, 160),
	Size = UDim2.new(1, -40, 0, 22),
	BackgroundTransparency = 1,
	Text = "Field of view",
	Font = Enum.Font.GothamBold,
	TextSize = 16,
	TextXAlignment = Enum.TextXAlignment.Left,
	TextColor3 = Color3.new(1, 1, 1),
}, panel)
local bar = make("Frame", {
	Position = UDim2.fromOffset(20, 194),
	Size = UDim2.new(1, -40, 0, 8),
	BackgroundColor3 = Color3.fromRGB(80, 80, 90),
}, panel)
local knob = make("Frame", {
	AnchorPoint = Vector2.new(0.5, 0.5),
	Position = UDim2.fromScale((camera.FieldOfView - 50) / 40, 0.5),
	Size = UDim2.fromOffset(18, 18),
	BackgroundColor3 = Color3.new(1, 1, 1),
}, bar)
make("UICorner", { CornerRadius = UDim.new(1, 0) }, knob)

local dragging = false
local function setFov(x)
	local t = math.clamp((x - bar.AbsolutePosition.X) / bar.AbsoluteSize.X, 0, 1)
	knob.Position = UDim2.fromScale(t, 0.5)
	camera.FieldOfView = 50 + t * 40
end
bar.InputBegan:Connect(function(i)
	if i.UserInputType == Enum.UserInputType.MouseButton1 or i.UserInputType == Enum.UserInputType.Touch then
		dragging = true
		setFov(i.Position.X)
	end
end)
UserInputService.InputChanged:Connect(function(i)
	if dragging and (i.UserInputType == Enum.UserInputType.MouseMovement or i.UserInputType == Enum.UserInputType.Touch) then
		setFov(i.Position.X)
	end
end)
UserInputService.InputEnded:Connect(function(i)
	if i.UserInputType == Enum.UserInputType.MouseButton1 or i.UserInputType == Enum.UserInputType.Touch then
		dragging = false
	end
end)

local close = make("TextButton", {
	Position = UDim2.new(0.5, -60, 1, -56),
	Size = UDim2.fromOffset(120, 38),
	BackgroundColor3 = Color3.fromRGB(190, 90, 60),
	Text = "Close",
	Font = Enum.Font.GothamBold,
	TextSize = 18,
	TextColor3 = Color3.new(1, 1, 1),
}, panel)
make("UICorner", { CornerRadius = UDim.new(0, 10) }, close)
close.Activated:Connect(function()
	gui.Enabled = false
end)

UserInputService.InputBegan:Connect(function(input, processed)
	if not processed and input.KeyCode == Enum.KeyCode.Escape and gui.Enabled then
		gui.Enabled = false
	end
end)
