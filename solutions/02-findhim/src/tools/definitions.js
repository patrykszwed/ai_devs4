export const tools = [
  {
    type: "function",
    name: "get_person_locations",
    description: "Get list of coordinates (lat, lng) where this person was seen. Call with name and surname.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "First name" },
        surname: { type: "string", description: "Last name" }
      },
      required: ["name", "surname"],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: "function",
    name: "get_access_level",
    description: "Get access level for a person. Requires name, surname and birthYear (from suspect data).",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "First name" },
        surname: { type: "string", description: "Last name" },
        birthYear: { type: "integer", description: "Year of birth" }
      },
      required: ["name", "surname", "birthYear"],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: "function",
    name: "check_near_power_plant",
    description: "Check if given coordinates are near any power plant (within 5 km). Returns powerPlant (code), city and distanceKm when near; otherwise powerPlant and city null. Use the result with smallest distanceKm when multiple persons match.",
    parameters: {
      type: "object",
      properties: {
        lat: { type: "number", description: "Latitude" },
        lng: { type: "number", description: "Longitude" }
      },
      required: ["lat", "lng"],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: "function",
    name: "submit_findhim_answer",
    description: "Submit the final answer to verify (name, surname, accessLevel, powerPlant code). Call once when you identified the suspect.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "First name" },
        surname: { type: "string", description: "Last name" },
        accessLevel: { type: "integer", description: "Access level from get_access_level" },
        powerPlant: { type: "string", description: "Power plant code e.g. PWR1234PL" }
      },
      required: ["name", "surname", "accessLevel", "powerPlant"],
      additionalProperties: false
    },
    strict: true
  }
];
