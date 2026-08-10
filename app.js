import { latviaDataSource } from "./src/data-sources/latvia.js";
import { lithuaniaDataSource } from "./src/data-sources/lithuania.js";

const sources = {
  latvia: latviaDataSource,
  lithuania: lithuaniaDataSource
};

const countrySelect = document.querySelector("#countrySelect");
const countryName = document.querySelector("#countryName");
const sourceDescription = document.querySelector("#sourceDescription");
const sourceLink = document.querySelector("#sourceLink");
const inspectButton = document.querySelector("#inspectButton");
const output = document.querySelector("#output");

function renderCountry() {
  const source = sources[countrySelect.value];
  countryName.textContent = source.name;
  sourceDescription.textContent = source.description;
  sourceLink.href = source.documentationUrl;
}

async function inspectSource() {
  const source = sources[countrySelect.value];
  output.textContent = `Inspecting ${source.name} data source...`;

  try {
    const result = await source.inspect();
    output.textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    output.textContent = JSON.stringify({
      country: source.name,
      status: "error",
      message: error.message
    }, null, 2);
  }
}

countrySelect.addEventListener("change", renderCountry);
inspectButton.addEventListener("click", inspectSource);
renderCountry();
