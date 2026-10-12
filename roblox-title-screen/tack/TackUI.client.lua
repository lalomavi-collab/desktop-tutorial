-- LocalScript: place in StarterPlayer > StarterPlayerScripts.
-- Horse customization panel: Riding / Turnout tabs, item list, color picker, Apply.
-- Press T to open or close. Sends requests to TackService, which validates them.
-- Sample code, not a finished product.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")

local TackData = require(ReplicatedStorage:WaitForChild("TackData"))
local remote = ReplicatedStorage:WaitForChild("TackEquip")

local gui = Instance.new("ScreenGui")
gui.Name = "TackUI"
gui.ResetOnSpawn = false
gui.Enabled = false
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
	Position = UDim2.fromOffset(20, 90),
	Size = UDim2.fromOffset(300, 560),
	BackgroundColor3 = Color3.fromRGB(150, 110, 70),
}, gui)
make("UICorner", { CornerRadius = UDim.new(0, 12) }, panel)

local mode = "Riding"
local selected = nil
local hue, sat, val = 0, 0, 1

local tabs = make("Frame", { Size = UDim2.new(1, 0, 0, 44), BackgroundTransparency = 1 }, panel)
local list = make("ScrollingFrame", {
	Position = UDim2.fromOffset(10, 54),
	Size = UDim2.new(1, -20, 0, 150),
	BackgroundColor3 = Color3.fromRGB(190, 150, 105),
	CanvasSize = UDim2.new(),
	AutomaticCanvasSize = Enum.AutomaticSize.Y,
}, panel)
make("UIListLayout", { Padding = UDim.new(0, 6) }, list)

local preview = make("Frame", {
	Position = UDim2.fromOffset(10, 480),
	Size = UDim2.fromOffset(40, 40),
	BackgroundColor3 = Color3.new(1, 1, 1),
}, panel)

local function refreshColor()
	preview.BackgroundColor3 = Color3.fromHSV(hue, sat, val)
end

local function slider(label, y, onChange)
	make("TextLabel", {
		Position = UDim2.fromOffset(10, y),
		Size = UDim2.fromOffset(60, 20),
		BackgroundTransparency = 1,
		Text = label,
		TextColor3 = Color3.new(1, 1, 1),
		Font = Enum.Font.GothamBold,
		TextSize = 14,
	}, panel)
	local bar = make("Frame", {
		Position = UDim2.fromOffset(80, y + 6),
		Size = UDim2.fromOffset(200, 8),
		BackgroundColor3 = Color3.fromRGB(60, 40, 25),
	}, panel)
	local dragging = false
	local function set(x)
		onChange(math.clamp((x - bar.AbsolutePosition.X) / bar.AbsoluteSize.X, 0, 1))
		refreshColor()
	end
	bar.InputBegan:Connect(function(i)
		if i.UserInputType == Enum.UserInputType.MouseButton1 or i.UserInputType == Enum.UserInputType.Touch then
			dragging = true
			set(i.Position.X)
		end
	end)
	UserInputService.InputChanged:Connect(function(i)
		if dragging and (i.UserInputType == Enum.UserInputType.MouseMovement or i.UserInputType == Enum.UserInputType.Touch) then
			set(i.Position.X)
		end
	end)
	UserInputService.InputEnded:Connect(function(i)
		if i.UserInputType == Enum.UserInputType.MouseButton1 or i.UserInputType == Enum.UserInputType.Touch then
			dragging = false
		end
	end)
end
slider("Bright", 440, function(v) val = v end)

-- Color wheel: hue is the angle, saturation is the distance from the center.
-- Built from thin rotated strips (no image asset needed), clipped to a circle.
local WHEEL = 180
local SEGMENTS = 90
local wheel = make("Frame", {
	Position = UDim2.fromOffset(60, 214),
	Size = UDim2.fromOffset(WHEEL, WHEEL),
	BackgroundColor3 = Color3.new(1, 1, 1),
	ClipsDescendants = true,
}, panel)
make("UICorner", { CornerRadius = UDim.new(1, 0) }, wheel)
for i = 0, SEGMENTS - 1 do
	local strip = make("Frame", {
		AnchorPoint = Vector2.new(0, 0.5),
		Position = UDim2.fromScale(0.5, 0.5),
		Size = UDim2.fromOffset(WHEEL / 2 + 2, math.ceil(math.pi * WHEEL / SEGMENTS) + 2),
		Rotation = i * 360 / SEGMENTS,
		BorderSizePixel = 0,
		BackgroundColor3 = Color3.new(1, 1, 1),
	}, wheel)
	-- white at the center fading to the pure hue at the edge
	make("UIGradient", {
		Color = ColorSequence.new(Color3.new(1, 1, 1), Color3.fromHSV(i / SEGMENTS, 1, 1)),
	}, strip)
end

local marker = make("Frame", {
	AnchorPoint = Vector2.new(0.5, 0.5),
	Position = UDim2.fromScale(0.5, 0.5),
	Size = UDim2.fromOffset(14, 14),
	BackgroundTransparency = 1,
	ZIndex = 5,
}, wheel)
make("UICorner", { CornerRadius = UDim.new(1, 0) }, marker)
make("UIStroke", { Color = Color3.new(0, 0, 0), Thickness = 2 }, marker)

local pickingWheel = false
local function pickFromWheel(pos)
	local center = wheel.AbsolutePosition + wheel.AbsoluteSize / 2
	local d = Vector2.new(pos.X, pos.Y) - center
	local r = wheel.AbsoluteSize.X / 2
	local dist = math.min(d.Magnitude, r)
	hue = (math.atan2(d.Y, d.X) / (2 * math.pi)) % 1
	sat = dist / r
	local clamped = d.Magnitude > 0 and d.Unit * dist or Vector2.zero
	marker.Position = UDim2.new(0.5, clamped.X, 0.5, clamped.Y)
	refreshColor()
end
wheel.InputBegan:Connect(function(i)
	if i.UserInputType == Enum.UserInputType.MouseButton1 or i.UserInputType == Enum.UserInputType.Touch then
		pickingWheel = true
		pickFromWheel(i.Position)
	end
end)
UserInputService.InputChanged:Connect(function(i)
	if pickingWheel and (i.UserInputType == Enum.UserInputType.MouseMovement or i.UserInputType == Enum.UserInputType.Touch) then
		pickFromWheel(i.Position)
	end
end)
UserInputService.InputEnded:Connect(function(i)
	if i.UserInputType == Enum.UserInputType.MouseButton1 or i.UserInputType == Enum.UserInputType.Touch then
		pickingWheel = false
	end
end)

local function rebuildList()
	for _, c in ipairs(list:GetChildren()) do
		if c:IsA("TextButton") then
			c:Destroy()
		end
	end
	for itemId, item in pairs(TackData.Items) do
		if item.Mode == mode then
			local b = make("TextButton", {
				Size = UDim2.new(1, -8, 0, 34),
				BackgroundColor3 = itemId == selected and Color3.fromRGB(70, 130, 220) or Color3.fromRGB(235, 235, 235),
				Text = item.Name,
				Font = Enum.Font.GothamBold,
				TextSize = 16,
			}, list)
			make("UICorner", { CornerRadius = UDim.new(0, 8) }, b)
			b.Activated:Connect(function()
				selected = itemId
				rebuildList()
			end)
		end
	end
end

for i, m in ipairs(TackData.Modes) do
	local t = make("TextButton", {
		Position = UDim2.new((i - 1) / #TackData.Modes, 8, 0, 6),
		Size = UDim2.new(1 / #TackData.Modes, -16, 0, 34),
		BackgroundColor3 = Color3.fromRGB(70, 130, 220),
		Text = m,
		Font = Enum.Font.GothamBold,
		TextSize = 20,
		TextColor3 = Color3.new(1, 1, 1),
	}, tabs)
	make("UICorner", { CornerRadius = UDim.new(0, 8) }, t)
	t.Activated:Connect(function()
		mode = m
		selected = nil
		rebuildList()
	end)
end

local apply = make("TextButton", {
	Position = UDim2.fromOffset(60, 480),
	Size = UDim2.fromOffset(100, 40),
	BackgroundColor3 = Color3.fromRGB(90, 170, 90),
	Text = "Apply",
	Font = Enum.Font.GothamBold,
	TextSize = 20,
	TextColor3 = Color3.new(1, 1, 1),
}, panel)
make("UICorner", { CornerRadius = UDim.new(0, 8) }, apply)
apply.Activated:Connect(function()
	if selected then
		remote:FireServer(selected, Color3.fromHSV(hue, sat, val))
	end
end)

local cancel = make("TextButton", {
	Position = UDim2.fromOffset(170, 480),
	Size = UDim2.fromOffset(100, 40),
	BackgroundColor3 = Color3.fromRGB(190, 90, 60),
	Text = "Cancel",
	Font = Enum.Font.GothamBold,
	TextSize = 20,
	TextColor3 = Color3.new(1, 1, 1),
}, panel)
make("UICorner", { CornerRadius = UDim.new(0, 8) }, cancel)
cancel.Activated:Connect(function()
	gui.Enabled = false
end)

UserInputService.InputBegan:Connect(function(input, processed)
	if not processed and input.KeyCode == Enum.KeyCode.T then
		gui.Enabled = not gui.Enabled
	end
end)

refreshColor()
rebuildList()
