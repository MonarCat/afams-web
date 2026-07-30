/* ── Afams · Premium Listings (Ad Spaces) · 2026 ──
   Direct-sold sponsor slots — no ad network.
   Managed entirely via the `premium_listings` table in Supabase.
   Positions: 'sidebar_left', 'sidebar_right' (desktop, wide screens only),
   'mobile_banner' (everyone else — phones, tablets, laptops).
   To sell a slot: insert a row in `premium_listings` with the sponsor's
   image, link, and position. To end a run: set active = false or set end_date.
*/
(function () {
  var WHATSAPP_ADVERTISE_LINK =
    'https://wa.me/254714128514?text=Hi%20Afams%21%20I%27d%20like%20to%20know%20more%20about%20advertising%20on%20afams.co.ke.';

  function fetchListings(position) {
    var url = SUPABASE_URL + '/rest/v1/premium_listings?position=eq.' + position +
      '&select=*&order=sort_order.asc&limit=1';
    return fetch(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
      },
    })
      .then(function (res) { return res.ok ? res.json() : []; })
      .catch(function () { return []; });
  }

  function logClick(listingId) {
    try {
      fetch(SUPABASE_URL + '/rest/v1/ad_clicks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ listing_id: listingId }),
      });
    } catch (e) { /* non-critical */ }
  }

  function renderSlot(container, listing) {
    if (!listing) {
      container.innerHTML =
        '<div class="ad-slot ad-slot-empty">' +
        '  <span class="ad-slot-label">Sponsored</span>' +
        '  <a class="ad-slot-placeholder" href="' + WHATSAPP_ADVERTISE_LINK + '" target="_blank" rel="noopener">' +
        '    <span class="ad-slot-placeholder-title">Advertise here</span>' +
        '    <span class="ad-slot-placeholder-sub">Reach urban growers · Enquire on WhatsApp</span>' +
        '  </a>' +
        '</div>';
      container.classList.remove('is-empty-hidden');
      return;
    }
    var safeAlt = listing.alt_text || listing.sponsor_name || 'Sponsored';
    container.innerHTML =
      '<div class="ad-slot">' +
      '  <span class="ad-slot-label">Sponsored</span>' +
      '  <a class="ad-slot-link" href="' + listing.link_url + '" target="_blank" rel="noopener sponsored" data-listing-id="' + listing.id + '">' +
      '    <img src="' + listing.image_url + '" alt="' + safeAlt + '" loading="lazy">' +
      '  </a>' +
      '</div>';
    var link = container.querySelector('.ad-slot-link');
    if (link) {
      link.addEventListener('click', function () { logClick(listing.id); });
    }
  }

  function loadSlot(elementId, position) {
    var el = document.getElementById(elementId);
    if (!el) return;
    fetchListings(position).then(function (rows) {
      renderSlot(el, rows && rows.length ? rows[0] : null);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    loadSlot('ad-rail-left', 'sidebar_left');
    loadSlot('ad-rail-right', 'sidebar_right');
    loadSlot('ad-mobile-banner-slot', 'mobile_banner');
  });
})();
