export function loadJourneyCatalogue(registry, readDescription) {
  return Object.fromEntries(Object.entries(registry).map(([name, path]) => {
    const description = readDescription(path);
    if (!description || typeof description.title !== 'string'
      || !Array.isArray(description.scenarios) || !description.scenarios.every((id) => typeof id === 'string')
      || !Array.isArray(description.steps) || !description.steps.every((step) => typeof step === 'string')) {
      throw new Error(`Invalid journey description: ${name} (${path}).`);
    }
    return [name, description];
  }));
}
