import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AdvancedMarker,
  APIProvider,
  Map as GoogleMap,
  Pin,
  useApiLoadingStatus,
  APILoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { MapPin, Navigation } from 'lucide-react';
import { Language } from '../types/store.ts';

interface DeliveryMapPickerProps {
  apiKey: string;
  storeLat: number;
  storeLng: number;
  storeName: string;
  customerLat: number | null;
  customerLng: number | null;
  lang: Language;
  addressValue: string;
  onAddressChange: (val: string) => void;
  onPlaceResolved: (info: {
    formattedAddress: string;
    placeId?: string;
    lat: number;
    lng: number;
  }) => void;
}

interface SuggestionLike {
  placePrediction?: {
    text: { text: string };
    toPlace: () => {
      fetchFields: (opts: { fields: string[] }) => Promise<void>;
      location?: { lat: () => number; lng: () => number };
      formattedAddress?: string;
      id?: string;
    };
  };
}

interface PolylineLike {
  setMap: (map: unknown) => void;
  setOptions: (opts: Record<string, unknown>) => void;
}

function PlacesAutocompleteField({
  addressValue,
  onAddressChange,
  onPlaceResolved,
  lang,
}: {
  addressValue: string;
  onAddressChange: (val: string) => void;
  onPlaceResolved: (info: {
    formattedAddress: string;
    placeId?: string;
    lat: number;
    lng: number;
  }) => void;
  lang: Language;
}) {
  const placesLib = useMapsLibrary('places');
  const sessionTokenRef = useRef<unknown>(null);
  const [suggestions, setSuggestions] = useState<SuggestionLike[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!placesLib || !addressValue.trim() || addressValue.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib as unknown as {
          AutocompleteSessionToken: new () => unknown;
          AutocompleteSuggestion: {
            fetchAutocompleteSuggestions: (req: Record<string, unknown>) => Promise<{
              suggestions?: SuggestionLike[];
            }>;
          };
        };
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new AutocompleteSessionToken();
        }
        const response = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: `${addressValue}, Karachi`,
          sessionToken: sessionTokenRef.current,
          includedRegionCodes: ['pk'],
        });
        setSuggestions(response.suggestions || []);
      } catch (err: any) {
        const msg = String(err?.message || err || '');
        if (msg.includes('Quota') || msg.includes('RESOURCE_EXHAUSTED')) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        setSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [placesLib, addressValue]);

  const handleSelectSuggestion = useCallback(
    async (suggestion: SuggestionLike) => {
      if (!placesLib || !suggestion.placePrediction) return;
      try {
        const place = suggestion.placePrediction.toPlace();
        await place.fetchFields({
          fields: ['formattedAddress', 'location', 'id'],
        });
        const loc = place.location;
        if (loc) {
          const lat = loc.lat();
          const lng = loc.lng();
          const formatted =
            place.formattedAddress || suggestion.placePrediction.text.text;
          onAddressChange(formatted);
          onPlaceResolved({
            formattedAddress: formatted,
            placeId: place.id,
            lat,
            lng,
          });
        }
      } catch (err) {
        console.error('Failed to fetch place fields:', err);
      } finally {
        sessionTokenRef.current = null;
        setSuggestions([]);
        setOpen(false);
      }
    },
    [placesLib, onAddressChange, onPlaceResolved]
  );

  return (
    <div className="relative">
      <input
        type="text"
        value={addressValue}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        onChange={(e) => {
          onAddressChange(e.target.value);
          setOpen(true);
        }}
        placeholder={
          lang === 'ur'
            ? 'مکان نمبر، گلی، بلاک، سیکٹر درج کریں...'
            : 'House #, Street, Block, Sector in Karachi...'
        }
        className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100">
          {suggestions.map((s, idx) => (
            <li key={idx}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  void handleSelectSuggestion(s);
                }}
                className="w-full text-start px-3 py-2 text-xs text-slate-700 hover:bg-emerald-50 flex items-center gap-2 cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span className="truncate">{s.placePrediction?.text.text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RoutePolylineOverlay({
  storeLat,
  storeLng,
  customerLat,
  customerLng,
}: {
  storeLat: number;
  storeLng: number;
  customerLat: number | null;
  customerLng: number | null;
}) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<PolylineLike[]>([]);

  useEffect(() => {
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    if (customerLat !== null && customerLng !== null && map) {
      const gMaps = (window as unknown as { google?: { maps?: { LatLngBounds?: new () => { extend: (pt: { lat: number; lng: number }) => void } } } }).google?.maps;
      if (gMaps?.LatLngBounds) {
        const bounds = new gMaps.LatLngBounds();
        bounds.extend({ lat: storeLat, lng: storeLng });
        bounds.extend({ lat: customerLat, lng: customerLng });
        map.fitBounds(bounds as unknown as Parameters<typeof map.fitBounds>[0], 40);
      }
    }

    if (!map || !routesLib || customerLat === null || customerLng === null) {
      return;
    }

    let cancelled = false;
    const request = {
      origin: { lat: storeLat, lng: storeLng },
      destination: { lat: customerLat, lng: customerLng },
      travelMode: 'DRIVING',
      fields: ['path', 'viewport'],
    };

    ((routesLib as unknown as { Route?: { computeRoutes: (req: unknown) => Promise<{ routes?: Array<{ createPolylines: () => PolylineLike[]; viewport?: unknown }> }> } }).Route)
      ?.computeRoutes(request)
      .then(({ routes }) => {
        if (cancelled || !routes || routes.length === 0) return;
        const primary = routes[0];
        const created = primary.createPolylines();
        created.forEach((p) => {
          p.setOptions({ strokeColor: '#15803d', strokeWeight: 5 });
          p.setMap(map);
        });
        polylinesRef.current = created;
        if (primary.viewport) {
          map.fitBounds(primary.viewport as Parameters<typeof map.fitBounds>[0]);
        }
      })
      .catch(() => {
        // Fallback: bounds already fitted above
      });

    return () => {
      cancelled = true;
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [map, routesLib, storeLat, storeLng, customerLat, customerLng]);

  return null;
}

function MapStatusMonitor({ children }: { children: React.ReactNode }) {
  const status = useApiLoadingStatus();

  useEffect(() => {
    if (status === APILoadingStatus.AUTH_FAILURE) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    }
  }, [status]);

  return <>{children}</>;
}

export function DeliveryMapPicker({
  apiKey,
  storeLat,
  storeLng,
  storeName,
  customerLat,
  customerLng,
  lang,
  addressValue,
  onAddressChange,
  onPlaceResolved,
}: DeliveryMapPickerProps) {
  if (!apiKey) {
    return (
      <div className="space-y-2">
        <input
          type="text"
          value={addressValue}
          onChange={(e) => onAddressChange(e.target.value)}
          placeholder={
            lang === 'ur'
              ? 'مکان نمبر، گلی، بلاک، سیکٹر درج کریں...'
              : 'House #, Street, Block, Sector in Karachi...'
          }
          className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700"
        />
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600 flex items-center gap-2">
          <Navigation className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>
            {lang === 'ur'
              ? 'اسٹور لوکیشن: مکان نمبر L-94، سیکٹر L-1، سرجانی ٹاؤن، کراچی'
              : 'Origin: House No. L-94, Sector L-1, Surjani Town, Karachi'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <APIProvider
      apiKey={apiKey}
      language={lang}
      region="PK"
    >
      <MapStatusMonitor>
        <div className="space-y-2.5">
          <PlacesAutocompleteField
            addressValue={addressValue}
            onAddressChange={onAddressChange}
            onPlaceResolved={onPlaceResolved}
            lang={lang}
          />
          <div className="w-full h-44 rounded-lg overflow-hidden border border-slate-200 bg-stone-100">
            <GoogleMap
              mapId="DEMO_MAP_ID"
              defaultCenter={{
                lat: customerLat ?? storeLat,
                lng: customerLng ?? storeLng,
              }}
              defaultZoom={customerLat ? 12 : 13}
              gestureHandling="greedy"
              disableDefaultUI={true}
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              style={{ width: '100%', height: '100%' }}
            >
              <AdvancedMarker position={{ lat: storeLat, lng: storeLng }} title={storeName}>
                <Pin background="#15803d" glyphColor="#ffffff" borderColor="#14532d" />
              </AdvancedMarker>
              {customerLat !== null && customerLng !== null && (
                <AdvancedMarker
                  position={{ lat: customerLat, lng: customerLng }}
                  title="Delivery Location"
                >
                  <Pin background="#0f172a" glyphColor="#ffffff" borderColor="#020617" />
                </AdvancedMarker>
              )}
              <RoutePolylineOverlay
                storeLat={storeLat}
                storeLng={storeLng}
                customerLat={customerLat}
                customerLng={customerLng}
              />
            </GoogleMap>
          </div>
        </div>
      </MapStatusMonitor>
    </APIProvider>
  );
}
