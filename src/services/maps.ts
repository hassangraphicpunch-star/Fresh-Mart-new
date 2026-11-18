// Google Maps Platform server-side Routes API & Geocoding API v4 integration
// Reference: https://developers.google.com/maps/documentation/routes/compute_route_matrix?utm_campaign=gmp_mcp_codeassist_v1_aistudio

export interface DistanceCalculationInput {
  storeLat: number;
  storeLng: number;
  storeAddress: string;
  ratePerKm: number;
  customerAddress: string;
  customerArea: string;
  customerPlaceId?: string;
  customerLat?: number;
  customerLng?: number;
  apiKey?: string | null;
}

export interface DistanceCalculationResult {
  verified: boolean;
  status: 'verified' | 'pending_manual';
  distanceKm: number | null;
  distanceMeters: number | null;
  durationText: string | null;
  deliveryFeePkr: number | null;
  ratePerKm: number;
  formattedDestination: string | null;
  customerLat: number | null;
  customerLng: number | null;
  encodedPolyline: string | null;
  quotaExceeded?: boolean;
  reason?: string;
}

const KARACHI_BOUNDS = {
  low: { latitude: 24.72, longitude: 66.65 },
  high: { latitude: 25.28, longitude: 67.45 },
};

function formatDuration(durationStr?: string): string | null {
  if (!durationStr) return null;
  const seconds = parseInt(durationStr.replace('s', ''), 10);
  if (Number.isNaN(seconds)) return null;
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem > 0 ? `${hrs} hr ${rem} min` : `${hrs} hr`;
  }
  return `${mins} min`;
}

export async function calculateKarachiRoadDistance(
  input: DistanceCalculationInput
): Promise<DistanceCalculationResult> {
  const apiKey =
    input.apiKey ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    '';

  if (!apiKey) {
    return {
      verified: false,
      status: 'pending_manual',
      distanceKm: null,
      distanceMeters: null,
      durationText: null,
      deliveryFeePkr: null,
      ratePerKm: input.ratePerKm,
      formattedDestination: null,
      customerLat: input.customerLat ?? null,
      customerLng: input.customerLng ?? null,
      encodedPolyline: null,
      reason:
        'Google Maps API key is not configured. Delivery charges will be confirmed manually by Fresh Mart.',
    };
  }

  let resolvedLat = input.customerLat ?? null;
  let resolvedLng = input.customerLng ?? null;
  let formattedDestination: string | null = null;
  let resolvedPlaceId = input.customerPlaceId || null;

  // Step 1: If no exact coordinates/placeId provided, geocode via Geocoding API v4 biased to Karachi
  if ((resolvedLat === null || resolvedLng === null) && !resolvedPlaceId) {
    const queryAddress = `${input.customerAddress.trim()}, ${input.customerArea.trim()}, Karachi, Pakistan`;
    const encodedAddr = encodeURIComponent(queryAddress);
    const geocodeUrl = `https://geocode.googleapis.com/v4/geocode/address/${encodedAddr}?regionCode=pk&locationBias.rectangle.low.latitude=${KARACHI_BOUNDS.low.latitude}&locationBias.rectangle.low.longitude=${KARACHI_BOUNDS.low.longitude}&locationBias.rectangle.high.latitude=${KARACHI_BOUNDS.high.latitude}&locationBias.rectangle.high.longitude=${KARACHI_BOUNDS.high.longitude}`;

    try {
      const geoRes = await fetch(geocodeUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask':
            'results.placeId,results.location,results.formattedAddress,results.granularity',
          'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
        },
      });

      if (geoRes.status === 429) {
        return {
          verified: false,
          status: 'pending_manual',
          distanceKm: null,
          distanceMeters: null,
          durationText: null,
          deliveryFeePkr: null,
          ratePerKm: input.ratePerKm,
          formattedDestination: null,
          customerLat: null,
          customerLng: null,
          encodedPolyline: null,
          quotaExceeded: true,
          reason:
            'Google Maps API quota reached. Fresh Mart will confirm your exact road distance manually.',
        };
      }

      if (geoRes.ok) {
        const geoJson: any = await geoRes.json();
        const first = geoJson?.results?.[0];
        if (
          typeof first?.location?.latitude === 'number' &&
          typeof first?.location?.longitude === 'number'
        ) {
          const latVal: number = first.location.latitude;
          const lngVal: number = first.location.longitude;
          resolvedLat = latVal;
          resolvedLng = lngVal;
          resolvedPlaceId = first.placeId || null;
          formattedDestination = first.formattedAddress || queryAddress;

          // Ensure geocoded location actually falls inside greater Karachi bounds
          const inKarachi =
            latVal >= 24.65 &&
            latVal <= 25.45 &&
            lngVal >= 66.55 &&
            lngVal <= 67.65;

          if (!inKarachi) {
            return {
              verified: false,
              status: 'pending_manual',
              distanceKm: null,
              distanceMeters: null,
              durationText: null,
              deliveryFeePkr: null,
              ratePerKm: input.ratePerKm,
              formattedDestination,
              customerLat: null,
              customerLng: null,
              encodedPolyline: null,
              reason:
                'Address could not be verified within Karachi delivery boundaries. Fresh Mart will confirm distance manually.',
            };
          }
        }
      }
    } catch (err) {
      console.error('Geocoding v4 lookup failed:', err);
    }
  }

  // Step 2: Compute actual driving road route via Routes API v2 computeRoutes
  const destinationWaypoint = resolvedPlaceId
    ? { placeId: resolvedPlaceId }
    : resolvedLat !== null && resolvedLng !== null
      ? {
          location: {
            latLng: {
              latitude: resolvedLat,
              longitude: resolvedLng,
            },
          },
        }
      : {
          address: `${input.customerAddress.trim()}, ${input.customerArea.trim()}, Karachi, Pakistan`,
        };

  const routesPayload = {
    origin: {
      location: {
        latLng: {
          latitude: input.storeLat,
          longitude: input.storeLng,
        },
      },
    },
    destination: destinationWaypoint,
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_AWARE',
    regionCode: 'pk',
    units: 'METRIC',
  };

  try {
    const routeRes = await fetch(
      'https://routes.googleapis.com/directions/v2:computeRoutes',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask':
            'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
          'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
        },
        body: JSON.stringify(routesPayload),
      }
    );

    if (routeRes.status === 429) {
      return {
        verified: false,
        status: 'pending_manual',
        distanceKm: null,
        distanceMeters: null,
        durationText: null,
        deliveryFeePkr: null,
        ratePerKm: input.ratePerKm,
        formattedDestination,
        customerLat: resolvedLat,
        customerLng: resolvedLng,
        encodedPolyline: null,
        quotaExceeded: true,
        reason:
          'Google Maps routing quota reached. Fresh Mart will verify road distance manually.',
      };
    }

    const routeJson: any = await routeRes.json();

    if (!routeRes.ok || routeJson?.error) {
      const isQuota = routeJson?.error?.status === 'RESOURCE_EXHAUSTED';
      return {
        verified: false,
        status: 'pending_manual',
        distanceKm: null,
        distanceMeters: null,
        durationText: null,
        deliveryFeePkr: null,
        ratePerKm: input.ratePerKm,
        formattedDestination,
        customerLat: resolvedLat,
        customerLng: resolvedLng,
        encodedPolyline: null,
        quotaExceeded: isQuota,
        reason:
          routeJson?.error?.message ||
          'Unable to verify driving route for this address. Store owner will confirm delivery fee manually.',
      };
    }

    const primaryRoute = routeJson?.routes?.[0];
    if (!primaryRoute || typeof primaryRoute.distanceMeters !== 'number') {
      return {
        verified: false,
        status: 'pending_manual',
        distanceKm: null,
        distanceMeters: null,
        durationText: null,
        deliveryFeePkr: null,
        ratePerKm: input.ratePerKm,
        formattedDestination,
        customerLat: resolvedLat,
        customerLng: resolvedLng,
        encodedPolyline: null,
        reason:
          'No driving route could be verified for this address. Fresh Mart will confirm delivery fee manually.',
      };
    }

    const distanceMeters = primaryRoute.distanceMeters;
    const distanceKm = Math.max(0.1, Math.round((distanceMeters / 1000) * 10) / 10);

    // Sanity check: Karachi road routes from Surjani Town should be <= 85 km
    if (distanceKm > 85) {
      return {
        verified: false,
        status: 'pending_manual',
        distanceKm: null,
        distanceMeters: null,
        durationText: null,
        deliveryFeePkr: null,
        ratePerKm: input.ratePerKm,
        formattedDestination,
        customerLat: resolvedLat,
        customerLng: resolvedLng,
        encodedPolyline: null,
        reason:
          'Verified route exceeds Karachi city bounds. Fresh Mart will confirm delivery charges manually.',
      };
    }

    const deliveryFeePkr = Math.round(distanceKm * input.ratePerKm);

    return {
      verified: true,
      status: 'verified',
      distanceKm,
      distanceMeters,
      durationText: formatDuration(primaryRoute.duration),
      deliveryFeePkr,
      ratePerKm: input.ratePerKm,
      formattedDestination:
        formattedDestination || `${input.customerAddress}, ${input.customerArea}, Karachi`,
      customerLat: resolvedLat,
      customerLng: resolvedLng,
      encodedPolyline: primaryRoute.polyline?.encodedPolyline || null,
    };
  } catch (err) {
    console.error('Routes API request failed:', err);
    return {
      verified: false,
      status: 'pending_manual',
      distanceKm: null,
      distanceMeters: null,
      durationText: null,
      deliveryFeePkr: null,
      ratePerKm: input.ratePerKm,
      formattedDestination,
      customerLat: resolvedLat,
      customerLng: resolvedLng,
      encodedPolyline: null,
      reason:
        'Could not reach Google Maps routing service. Store owner will confirm delivery fee manually.',
    };
  }
}
