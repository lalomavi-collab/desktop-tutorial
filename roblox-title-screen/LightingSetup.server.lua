-- Script: place in ServerScriptService.
-- Realistic farm lighting: warm sun, atmosphere haze, soft bloom, gentle color grading.
-- Set Lighting.Technology to Future by hand in Studio. Scripts are not allowed to change it.
-- Sample code, not a finished product.

local Lighting = game:GetService("Lighting")

local function effect(class, props)
	local e = Lighting:FindFirstChildOfClass(class) or Instance.new(class)
	for k, v in pairs(props) do
		e[k] = v
	end
	e.Parent = Lighting
	return e
end

Lighting.ClockTime = 16.5 -- late afternoon, long warm light
Lighting.Brightness = 3
Lighting.GeographicLatitude = 41
Lighting.ExposureCompensation = 0
Lighting.EnvironmentDiffuseScale = 1
Lighting.EnvironmentSpecularScale = 1
Lighting.GlobalShadows = true
Lighting.OutdoorAmbient = Color3.fromRGB(110, 120, 130)
Lighting.Ambient = Color3.fromRGB(70, 70, 75)

effect("Atmosphere", {
	Density = 0.3,
	Offset = 0.25,
	Color = Color3.fromRGB(199, 210, 225),
	Decay = Color3.fromRGB(255, 214, 170),
	Glare = 0.2,
	Haze = 1.2,
})

effect("BloomEffect", { Intensity = 0.25, Size = 24, Threshold = 1.6 })
effect("SunRaysEffect", { Intensity = 0.08, Spread = 0.6 })
effect("ColorCorrectionEffect", {
	Brightness = 0,
	Contrast = 0.08,
	Saturation = 0.1,
	TintColor = Color3.fromRGB(255, 247, 235),
})
effect("DepthOfFieldEffect", { FarIntensity = 0.1, FocusDistance = 60, InFocusRadius = 40, NearIntensity = 0 })

-- Slow day and night cycle: about 24 real minutes per in-game day.
task.spawn(function()
	while true do
		Lighting.ClockTime = (Lighting.ClockTime + 0.01) % 24
		task.wait(0.4)
	end
end)
