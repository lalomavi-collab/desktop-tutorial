-- LocalScript: place in StarterPlayer > StarterPlayerScripts
-- Title screen modeled on the reference screenshot: circular logo, PLAY / SETTINGS / CREDITS, news panel.
-- Disclaimer: sample code, not a finished product.

local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local Lighting = game:GetService("Lighting")
local RunService = game:GetService("RunService")

local CONFIG = {
	GameName = "Emmy",
	LogoImageId = "rbxassetid://0", -- replace with the uploaded logo asset id
	NewsTitle = "MOVING DAY",
	NewsBody = "The game has officially been moved! It will remain under the group from here out.",
	Credits = "Made for Emmy\nby her father, Dr. Avraham Lalum, Adv.",
	Font = Enum.Font.GothamBold,
	Button = Color3.fromRGB(35, 35, 40),
	Text = Color3.fromRGB(255, 255, 255),
}

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

-- Background blur and a fixed camera so the world shows behind the menu
local blur = Instance.new("BlurEffect")
blur.Size = 18
blur.Parent = Lighting

local camera = workspace.CurrentCamera
camera.CameraType = Enum.CameraType.Scriptable
local anchor = workspace:FindFirstChild("TitleCameraPart")
if anchor then
	camera.CFrame = anchor.CFrame
end

local gui = Instance.new("ScreenGui")
gui.Name = "TitleScreen"
gui.IgnoreGuiInset = true
gui.ResetOnSpawn = false
gui.DisplayOrder = 100
gui.Parent = playerGui

local function make(class, props, parent)
	local obj = Instance.new(class)
	for k, v in pairs(props) do
		obj[k] = v
	end
	obj.Parent = parent
	return obj
end

local root = make("Frame", {
	Size = UDim2.fromScale(1, 1),
	BackgroundTransparency = 1,
}, gui)

-- Circular logo
local logo = make("ImageLabel", {
	AnchorPoint = Vector2.new(0.5, 0.5),
	Position = UDim2.fromScale(0.42, 0.42),
	Size = UDim2.fromOffset(260, 260),
	BackgroundColor3 = Color3.fromRGB(20, 20, 20),
	Image = CONFIG.LogoImageId,
}, root)
make("UICorner", { CornerRadius = UDim.new(1, 0) }, logo)

make("TextLabel", {
	AnchorPoint = Vector2.new(0.5, 0),
	Position = UDim2.fromScale(0.42, 0.62),
	Size = UDim2.fromOffset(420, 40),
	BackgroundTransparency = 1,
	Text = CONFIG.GameName,
	Font = CONFIG.Font,
	TextSize = 30,
	TextColor3 = CONFIG.Text,
}, root)

-- Buttons
local function menuButton(text, y)
	local b = make("TextButton", {
		AnchorPoint = Vector2.new(0.5, 0),
		Position = UDim2.fromScale(0.42, y),
		Size = UDim2.fromOffset(240, 36),
		BackgroundColor3 = CONFIG.Button,
		BackgroundTransparency = 0.15,
		Text = text,
		Font = CONFIG.Font,
		TextSize = 18,
		TextColor3 = CONFIG.Text,
		AutoButtonColor = true,
	}, root)
	make("UICorner", { CornerRadius = UDim.new(0, 12) }, b)
	return b
end

local playBtn = menuButton("PLAY", 0.70)
local settingsBtn = menuButton("SETTINGS", 0.76)
local creditsBtn = menuButton("CREDITS", 0.82)

-- News panel on the right
local news = make("Frame", {
	AnchorPoint = Vector2.new(1, 0.5),
	Position = UDim2.fromScale(0.95, 0.45),
	Size = UDim2.fromOffset(380, 360),
	BackgroundTransparency = 1,
}, root)
make("TextLabel", {
	Size = UDim2.new(1, 0, 0, 60),
	BackgroundTransparency = 1,
	Text = CONFIG.NewsTitle,
	Font = CONFIG.Font,
	TextSize = 44,
	TextColor3 = CONFIG.Text,
}, news)
make("TextLabel", {
	Position = UDim2.fromOffset(0, 70),
	Size = UDim2.new(1, 0, 1, -70),
	BackgroundTransparency = 1,
	Text = CONFIG.NewsBody,
	Font = Enum.Font.Gotham,
	TextSize = 34,
	TextWrapped = true,
	TextYAlignment = Enum.TextYAlignment.Top,
	TextColor3 = CONFIG.Text,
}, news)

-- Credits popup
local creditsFrame = make("Frame", {
	AnchorPoint = Vector2.new(0.5, 0.5),
	Position = UDim2.fromScale(0.5, 0.5),
	Size = UDim2.fromOffset(420, 220),
	BackgroundColor3 = Color3.fromRGB(20, 20, 24),
	Visible = false,
}, root)
make("UICorner", { CornerRadius = UDim.new(0, 14) }, creditsFrame)
make("TextLabel", {
	Size = UDim2.new(1, -30, 1, -30),
	Position = UDim2.fromOffset(15, 15),
	BackgroundTransparency = 1,
	Text = CONFIG.Credits,
	Font = Enum.Font.Gotham,
	TextSize = 22,
	TextWrapped = true,
	TextColor3 = CONFIG.Text,
}, creditsFrame)

creditsBtn.Activated:Connect(function()
	creditsFrame.Visible = not creditsFrame.Visible
end)

-- Settings hook: wire this to your own settings UI
settingsBtn.Activated:Connect(function()
	local settingsGui = playerGui:FindFirstChild("SettingsGui")
	if settingsGui then
		settingsGui.Enabled = not settingsGui.Enabled
	end
end)

-- PLAY: fade out, drop the blur, hand the camera back to the character
playBtn.Activated:Connect(function()
	playBtn.Active = false
	local info = TweenInfo.new(0.6, Enum.EasingStyle.Quad, Enum.EasingDirection.Out)
	TweenService:Create(blur, info, { Size = 0 }):Play()
	for _, d in ipairs(root:GetDescendants()) do
		if d:IsA("TextLabel") or d:IsA("TextButton") then
			TweenService:Create(d, info, { TextTransparency = 1, BackgroundTransparency = 1 }):Play()
		elseif d:IsA("ImageLabel") then
			TweenService:Create(d, info, { ImageTransparency = 1, BackgroundTransparency = 1 }):Play()
		end
	end
	task.wait(0.7)
	camera.CameraType = Enum.CameraType.Custom
	local hum = player.Character and player.Character:FindFirstChildOfClass("Humanoid")
	if hum then
		camera.CameraSubject = hum
	end
	blur:Destroy()
	gui:Destroy()
end)
