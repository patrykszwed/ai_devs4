export const tools = [
  {
    type: "function" as const,
    name: "call_drone_api",
    description:
      'Send control instructions to the DRN-BMB7 drone. Takes an ordered array of instruction strings. Example: ["setDestinationObject(PWR6132PL)", "set(2,4)", "set(engineON)", "set(100%)", "set(50m)", "set(destroy)", "set(return)", "flyToLocation"]',
    parameters: {
      type: "object",
      properties: {
        instructions: {
          type: "array",
          items: { type: "string" },
          description: "Ordered array of drone instruction strings",
        },
      },
      required: ["instructions"],
      additionalProperties: false,
    },
    strict: true,
  },
] as const;
