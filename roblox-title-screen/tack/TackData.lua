-- ModuleScript: place in ReplicatedStorage and name it TackData.
-- Catalog of equipment. Add an item by adding one entry. Sample code, not a finished product.

local TackData = {}

-- Attachment names that must exist on the horse model (see TackService)
TackData.Slots = { "Head", "Back", "Neck" }

TackData.Items = {
	Halter = { Name = "Halter", Slot = "Head", ModelName = "Halter" },
	Bridle = { Name = "Bridle", Slot = "Head", ModelName = "Bridle" },
	Saddle = { Name = "Saddle", Slot = "Back", ModelName = "Saddle" },
	Blanket = { Name = "Blanket", Slot = "Back", ModelName = "Blanket" },
	LeadRope = { Name = "Lead rope", Slot = "Neck", ModelName = "LeadRope" },
}

function TackData.isValid(itemId)
	return type(itemId) == "string" and TackData.Items[itemId] ~= nil
end

return TackData
