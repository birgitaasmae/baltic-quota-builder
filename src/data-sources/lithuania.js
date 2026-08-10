export const lithuaniaDataSource = {
  name: "Lithuania",
  description: "Official Statistics Portal SDMX 2.1 REST API.",
  documentationUrl: "https://osp.stat.gov.lt/en/rdb-rest",
  baseUrl: "https://osp.stat.gov.lt/services-portlet/sdmxrest",

  async inspect() {
    return {
      country: "Lithuania",
      source: "Official Statistics Portal of Lithuania",
      api: "SDMX 2.1 REST",
      baseUrl: this.baseUrl,
      status: "adapter scaffolded",
      nextStep: "Map official population dataflows and native dimension codes before enabling quota calculations."
    };
  }
};
