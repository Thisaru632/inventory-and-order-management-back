/**
 * Converts a quantity from a given unit to the material's base unit.
 * @param {Object} material - The mongoose Material document.
 * @param {String} inputUnit - The unit of the input quantity.
 * @param {Number} inputQuantity - The quantity to convert.
 * @returns {Number} The exact quantity in the base unit.
 */
const convertToBaseUnit = (material, inputUnit, inputQuantity) => {
  if (!material) {
    throw new Error('Material not found for unit conversion.');
  }

  // If the input unit is already the base unit, no conversion needed.
  if (inputUnit === material.baseUnit) {
    return inputQuantity;
  }

  // Find the conversion rule for the input unit.
  const conversionRule = material.conversions.find(c => c.unit === inputUnit);

  if (!conversionRule) {
    throw new Error(`Conversion rule for unit '${inputUnit}' not found for material '${material.name}'.`);
  }

  return inputQuantity * conversionRule.multiplier;
};

module.exports = {
  convertToBaseUnit
};
