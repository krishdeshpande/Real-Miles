import { Vehicle } from "@/lib/types";

export interface SeedVehicleDefinition {
  id: string;
  slug: string;
  make: string;
  model: string;
  category: "car" | "bike";
  fuel_type: string;
  hero_path?: string | null;
  created_at: string;
  tagline: string;
}

export const SEED_VEHICLES: SeedVehicleDefinition[] = [
  {
    id: "v0000001-0000-0000-0000-000000000001",
    slug: "mahindra-thar",
    make: "Mahindra",
    model: "Thar",
    category: "car",
    fuel_type: "Diesel",
    hero_path: null,
    created_at: "2026-01-01T00:00:00Z",
    tagline: "Rugged body-on-frame 4x4 built for trails, touring, and Indian road realities."
  },
  {
    id: "v0000001-0000-0000-0000-000000000002",
    slug: "tata-harrier",
    make: "Tata",
    model: "Harrier",
    category: "car",
    fuel_type: "Diesel",
    hero_path: null,
    created_at: "2026-01-01T00:00:00Z",
    tagline: "OMEGARC platform midsize SUV offering highway composure and commanding stance."
  },
  {
    id: "v0000001-0000-0000-0000-000000000003",
    slug: "hyundai-creta",
    make: "Hyundai",
    model: "Creta",
    category: "car",
    fuel_type: "Petrol",
    hero_path: null,
    created_at: "2026-01-01T00:00:00Z",
    tagline: "India's bestselling urban crossover blending refinement, light controls, and feature tech."
  },
  {
    id: "v0000001-0000-0000-0000-000000000004",
    slug: "bmw-330li",
    make: "BMW",
    model: "330Li",
    category: "car",
    fuel_type: "Petrol",
    hero_path: null,
    created_at: "2026-01-01T00:00:00Z",
    tagline: "Long-wheelbase executive saloon offering sharp chassis dynamics and rear legroom luxury."
  },
  {
    id: "v0000001-0000-0000-0000-000000000005",
    slug: "ktm-390-adventure-s",
    make: "KTM",
    model: "390 Adventure S",
    category: "bike",
    fuel_type: "Petrol",
    hero_path: null,
    created_at: "2026-01-01T00:00:00Z",
    tagline: "Fast single-cylinder adventure tourer with WP suspension and comprehensive electronics."
  },
  {
    id: "v0000001-0000-0000-0000-000000000006",
    slug: "re-himalayan-450",
    make: "Royal Enfield",
    model: "Himalayan 450",
    category: "bike",
    fuel_type: "Petrol",
    hero_path: null,
    created_at: "2026-01-01T00:00:00Z",
    tagline: "Liquid-cooled Sherpa 450 expedition machine built for high altitude and rough terrains."
  },
  {
    id: "v0000001-0000-0000-0000-000000000007",
    slug: "re-classic-350",
    make: "Royal Enfield",
    model: "Classic 350",
    category: "bike",
    fuel_type: "Petrol",
    hero_path: null,
    created_at: "2026-01-01T00:00:00Z",
    tagline: "Quintessential J-series retro cruiser offering relaxed low-end torque and timeless styling."
  },
  {
    id: "v0000001-0000-0000-0000-000000000008",
    slug: "ktm-390-duke",
    make: "KTM",
    model: "390 Duke",
    category: "bike",
    fuel_type: "Petrol",
    hero_path: null,
    created_at: "2026-01-01T00:00:00Z",
    tagline: "The corner rocket naked streetfighter with aggressive power-to-weight and razor agility."
  }
];

export function getMockVehicles(): Vehicle[] {
  return SEED_VEHICLES.map(({ id, slug, make, model, category, fuel_type, hero_path, created_at }) => ({
    id,
    slug,
    make,
    model,
    category,
    fuel_type,
    hero_path,
    created_at,
  }));
}
