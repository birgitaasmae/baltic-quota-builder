export const latviaDataSource = {
  name: "Latvia",
  description: "Official Statistics Portal API / PxWeb API.",
  documentationUrl: "https://stat.gov.lv/en/api-un-kodu-vardnicas/api-v2",
  baseUrl: "https://api.stat.gov.lv/api/v2",

  async inspect() {
    return {
      country: "Latvia",
      source: "Official Statistics Portal of Latvia",
      api: "PxWeb API v2",
      baseUrl: this.baseUrl,
      status: "adapter scaffolded",
      nextStep: "Map official population tables and native dimension codes before enabling quota calculations."
    };
  }
};
