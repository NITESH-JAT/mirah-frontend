/** Display order: city → state → pin → country */
export function addressLocationParts({ city, state, pinCode, pincode, postalCode, country } = {}) {
  const pin = pinCode ?? pincode ?? postalCode;
  return [city, state, pin, country].filter(Boolean);
}
