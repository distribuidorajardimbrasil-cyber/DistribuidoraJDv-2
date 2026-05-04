import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';

// Fix Leaflet's default icon path issues
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface LocationUpdate {
  deliveryman_id: string;
  latitude: number;
  longitude: number;
  updated_at: string;
}

function MapController({ center }: { center: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 15, { animate: true, duration: 1 });
    }
  }, [center, map]);
  return null;
}

export default function LiveMap() {
  const [locations, setLocations] = useState<Record<string, LocationUpdate>>({});
  const [deliverymen, setDeliverymen] = useState<Record<string, Profile>>({});
  const [selectedCenter, setSelectedCenter] = useState<[number, number] | null>(null);

  useEffect(() => {
    // 1. Fetch deliverymen
    const fetchDeliverymen = async () => {
      const { data } = await supabase.from('profiles').select('*').eq('role', 'entregador');
      if (data) {
        const dict: Record<string, Profile> = {};
        data.forEach(d => dict[d.id] = d as Profile);
        setDeliverymen(dict);
      }
    };

    // 2. Fetch initial locations
    const fetchLocations = async () => {
      const { data } = await supabase.from('deliveryman_locations').select('*');
      if (data) {
        const dict: Record<string, LocationUpdate> = {};
        data.forEach(d => dict[d.deliveryman_id] = d as LocationUpdate);
        setLocations(dict);
      }
    };

    fetchDeliverymen();
    fetchLocations();

    // 3. Subscribe to realtime updates
    const channel = supabase
      .channel('deliveryman_locations_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveryman_locations' }, (payload) => {
        const newLoc = payload.new as LocationUpdate;
        setLocations(prev => ({ ...prev, [newLoc.deliveryman_id]: newLoc }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const defaultCenter: [number, number] = [-15.793889, -47.882778]; // Default to Brasilia
  const validLocations = Object.values(locations).filter(loc => loc.latitude && loc.longitude);
  
  const mapCenter = validLocations.length > 0 
    ? [validLocations[0].latitude, validLocations[0].longitude] as [number, number]
    : defaultCenter;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Mapa ao Vivo</h2>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">Acompanhe a localização dos entregadores em tempo real.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 h-[600px]">
        {/* Entregadores List */}
        <div className="w-full lg:w-72 bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm dark:shadow-none overflow-y-auto shrink-0">
          <h3 className="font-bold text-lg mb-4">Entregadores Ativos</h3>
          <div className="space-y-3">
            {validLocations.map(loc => (
              <button 
                key={loc.deliveryman_id}
                onClick={() => setSelectedCenter([loc.latitude, loc.longitude])}
                className="w-full text-left p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800/50 hover:border-emerald-200 dark:hover:border-emerald-800 hover:shadow-md dark:hover:shadow-none transition-all flex items-center justify-between group"
              >
                <div>
                  <span className="font-bold text-zinc-900 dark:text-zinc-50 block group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    {deliverymen[loc.deliveryman_id]?.name || 'Entregador'}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-medium">
                    {new Date(loc.updated_at).toLocaleTimeString('pt-BR')}
                  </span>
                </div>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200 animate-pulse"></span>
              </button>
            ))}
            {validLocations.length === 0 && (
              <p className="text-zinc-500 dark:text-zinc-400 text-sm text-center py-8">Nenhum entregador transmitindo localização.</p>
            )}
          </div>
        </div>

        {/* Map Container */}
        <div className="flex-1 bg-white dark:bg-zinc-900 rounded-3xl p-4 border border-zinc-200 dark:border-zinc-800 shadow-sm dark:shadow-none overflow-hidden relative z-0">
          <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%', borderRadius: '1.5rem', zIndex: 10 }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapController center={selectedCenter} />
            {validLocations.map((loc) => (
              <Marker key={loc.deliveryman_id} position={[loc.latitude, loc.longitude]}>
                <Popup>
                  <div className="font-bold text-zinc-900">{deliverymen[loc.deliveryman_id]?.name || 'Entregador'}</div>
                  <div className="text-xs text-zinc-500">
                    Atualizado em: {new Date(loc.updated_at).toLocaleTimeString('pt-BR')}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
