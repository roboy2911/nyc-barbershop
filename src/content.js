// Text and links that appear on the site. Edit here to change wording.

export const SHOP = {
  name: 'NYC Barbershop',
  addressLines: ['Shop 9, 328 Foxwell Road', 'Coomera East Shopping Centre', 'Coomera QLD 4209'],
  mapQuery: 'NYC Barbershop, Shop 9, 328 Foxwell Road, Coomera QLD 4209',
  facebook: 'https://www.facebook.com/people/NYC-Barbershop/61551744285862/',
  instagram: 'https://www.instagram.com/nycbarbershop.gc/',
  instagramHandle: '@nycbarbershop.gc',
};

export const telHref = (phone) => `tel:+61${String(phone || '').replace(/\D/g, '').replace(/^0/, '')}`;
export const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(SHOP.mapQuery)}`;
export const mapEmbedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(SHOP.mapQuery)}&z=16&output=embed`;

// DRAFT – for the shop owner to edit.
export const ABOUT = {
  heading: 'Old-school craft. New York attitude.',
  paragraphs: [
    'NYC Barbershop brings a little bit of the Big Apple to the Gold Coast. Since opening our doors in 2023 at Coomera East Shopping Centre, we have built our shop on sharp cuts, clean fades and the kind of relaxed, friendly chat that keeps people coming back.',
    "Whether it's a skin fade, a classic scissor cut, a beard shape-up or a quick line up between visits, our barbers take the time to get it right. Every cut is finished properly – clean edges, sharp lines and styled the way you like it.",
    'Book online in under a minute, or just walk in – walk-ins are always welcome. Kids, teens, tradies, office crew – everyone gets the same attention to detail.',
  ],
};

// PLACEHOLDER reviews – replace with real ones.
export const REVIEWS = [
  { name: 'Placeholder Customer', stars: 5, text: 'Placeholder review – best fade I have had on the Gold Coast. Friendly crew and always on time.' },
  { name: 'Placeholder Customer', stars: 5, text: 'Placeholder review – booked online, walked straight in to the chair. Beard has never looked better.' },
  { name: 'Placeholder Customer', stars: 5, text: 'Placeholder review – great with my kids, patient and the cuts are spot on every time.' },
  { name: 'Placeholder Customer', stars: 5, text: 'Placeholder review – clean shop, good chat, sharp line up. Will be back in two weeks.' },
  { name: 'Placeholder Customer', stars: 5, text: 'Placeholder review – walked in on a Thursday night and got looked after straight away.' },
  { name: 'Placeholder Customer', stars: 5, text: 'Placeholder review – Tom and John know exactly what they are doing. Highly recommend.' },
];

export const GALLERY_COUNT = 6;
