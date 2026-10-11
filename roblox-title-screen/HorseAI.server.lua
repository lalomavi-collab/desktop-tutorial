-- Script: place in ServerScriptService.
-- Horses in Workspace.Horses wander inside the paddock: walk to a random point, stop, graze, repeat.
-- A horse stops while a player is close, so players can equip tack. A slight bob gives a walking feel.
-- Sample code: with a real rigged model, replace the bob with an AnimationTrack.

local RunService = game:GetService("RunService")
local Players = game:GetService("Players")

local horses = workspace:WaitForChild("Horses")
local BOUNDS = 32 -- paddock half size minus margin
local SPEED = 3.5
local PLAYER_STOP_DISTANCE = 10

local state = {}

local function playerNear(pos)
	for _, plr in ipairs(Players:GetPlayers()) do
		local root = plr.Character and plr.Character:FindFirstChild("HumanoidRootPart")
		if root and (root.Position - pos).Magnitude < PLAYER_STOP_DISTANCE then
			return true
		end
	end
	return false
end

local function newTarget()
	return Vector3.new(math.random(-BOUNDS, BOUNDS), 0, math.random(-BOUNDS, BOUNDS))
end

local function register(horse)
	if not horse:IsA("Model") then
		return
	end
	task.defer(function()
		if horse.PrimaryPart then
			state[horse] = { target = nil, wait = math.random(2, 6), baseY = horse:GetPivot().Position.Y, t = 0 }
		end
	end)
end

for _, h in ipairs(horses:GetChildren()) do
	register(h)
end
horses.ChildAdded:Connect(register)
horses.ChildRemoved:Connect(function(h)
	state[h] = nil
end)

RunService.Heartbeat:Connect(function(dt)
	for horse, s in pairs(state) do
		local pivot = horse:GetPivot()
		if not playerNear(pivot.Position) then
			if s.target then
				local pos = pivot.Position
				local flat = Vector3.new(s.target.X - pos.X, 0, s.target.Z - pos.Z)
				if flat.Magnitude < 1 then
					s.target = nil
					s.wait = math.random(3, 9)
				else
					s.t = s.t + dt * 6
					local step = flat.Unit * SPEED * dt
					local bob = math.sin(s.t) * 0.08
					local newPos = Vector3.new(pos.X + step.X, s.baseY + bob, pos.Z + step.Z)
					local look = CFrame.lookAt(newPos, newPos + flat.Unit)
					horse:PivotTo(pivot:Lerp(look, math.min(dt * 3, 1)))
				end
			else
				s.wait = s.wait - dt
				if s.wait <= 0 then
					s.target = newTarget()
				end
			end
		end
	end
end)
