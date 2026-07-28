// Place at: src/lib/locationData.js
// Reference data for the "Location" field type's Country → State → City
// cascade. Plain nested object on purpose — adding a country or a city is
// just editing data here, no other file needs to change. Only Nigeria is
// filled in for now (this app's primary market, per the ₦ currency used
// throughout); add more countries the same shape when needed.
export const LOCATION_DATA = {
  Nigeria: {
    'Abia': ['Umuahia', 'Aba', 'Ohafia'],
    'Adamawa': ['Yola', 'Mubi', 'Numan'],
    'Akwa Ibom': ['Uyo', 'Ikot Ekpene', 'Eket'],
    'Anambra': ['Awka', 'Onitsha', 'Nnewi'],
    'Bauchi': ['Bauchi', 'Azare', 'Misau'],
    'Bayelsa': ['Yenagoa', 'Brass', 'Sagbama'],
    'Benue': ['Makurdi', 'Gboko', 'Otukpo'],
    'Borno': ['Maiduguri', 'Biu', 'Bama'],
    'Cross River': ['Calabar', 'Ugep', 'Ikom'],
    'Delta': ['Asaba', 'Warri', 'Sapele'],
    'Ebonyi': ['Abakaliki', 'Afikpo', 'Onueke'],
    'Edo': ['Benin City', 'Auchi', 'Ekpoma'],
    'Ekiti': ['Ado Ekiti', 'Ikere Ekiti', 'Ise Ekiti'],
    'Enugu': ['Enugu', 'Nsukka', 'Agbani'],
    'Gombe': ['Gombe', 'Kaltungo', 'Billiri'],
    'Imo': ['Owerri', 'Orlu', 'Okigwe'],
    'Jigawa': ['Dutse', 'Hadejia', 'Gumel'],
    'Kaduna': ['Kaduna', 'Zaria', 'Kafanchan'],
    'Kano': ['Kano', 'Wudil', 'Gwarzo'],
    'Katsina': ['Katsina', 'Funtua', 'Daura'],
    'Kebbi': ['Birnin Kebbi', 'Argungu', 'Zuru'],
    'Kogi': ['Lokoja', 'Okene', 'Idah'],
    'Kwara': ['Ilorin', 'Offa', 'Omu Aran'],
    'Lagos': ['Ikeja', 'Lagos Island', 'Lekki', 'Ikorodu', 'Badagry', 'Epe'],
    'Nasarawa': ['Lafia', 'Keffi', 'Akwanga'],
    'Niger': ['Minna', 'Bida', 'Suleja'],
    'Ogun': ['Abeokuta', 'Sagamu', 'Ijebu Ode'],
    'Ondo': ['Akure', 'Ondo City', 'Owo'],
    'Osun': ['Osogbo', 'Ile Ife', 'Ilesa'],
    'Oyo': ['Ibadan', 'Ogbomoso', 'Iseyin'],
    'Plateau': ['Jos', 'Bukuru', 'Pankshin'],
    'Rivers': ['Port Harcourt', 'Bonny', 'Obio-Akpor'],
    'Sokoto': ['Sokoto', 'Tambuwal', 'Wurno'],
    'Taraba': ['Jalingo', 'Wukari', 'Bali'],
    'Yobe': ['Damaturu', 'Potiskum', 'Gashua'],
    'Zamfara': ['Gusau', 'Kaura Namoda', 'Talata Mafara'],
    'Abuja (FCT)': ['Abuja', 'Gwagwalada', 'Kuje'],
  },
}

export const COUNTRIES = Object.keys(LOCATION_DATA)

export function statesFor(country) {
  return Object.keys(LOCATION_DATA[country] || {})
}

export function citiesFor(country, state) {
  return (LOCATION_DATA[country] || {})[state] || []
}
