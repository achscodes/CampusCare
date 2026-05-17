import type { Staff } from './types';

/** Four campus doctors with photos (Health Service “popular” grid). */
export const MOCK_STAFF: Staff[] = [
  {
    id: 'hs-1',
    name: 'Dr. Maria Chen',
    role: 'doctor',
    specialtyLabel: 'General Medicine',
    photoUrl:
      'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&w=384&h=384&fit=crop&q=85',
    priceLabel: 'Covered by student plan',
    rating: 4.9,
  },
  {
    id: 'hs-2',
    name: 'Dr. James Okonkwo',
    role: 'doctor',
    specialtyLabel: 'Sports Medicine',
    photoUrl:
      'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&w=384&h=384&fit=crop&q=85',
    priceLabel: 'Covered by student plan',
    rating: 4.8,
  },
  {
    id: 'hs-3',
    name: 'Dr. Elena Rivera',
    role: 'doctor',
    specialtyLabel: 'Family Medicine',
    photoUrl:
      'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&w=384&h=384&fit=crop&q=85',
    priceLabel: 'Covered by student plan',
    rating: 4.7,
  },
  {
    id: 'hs-4',
    name: 'Dr. Marcus Webb',
    role: 'doctor',
    specialtyLabel: 'Internal Medicine',
    photoUrl:
      'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&w=384&h=384&fit=crop&q=85',
    priceLabel: 'Covered by student plan',
    rating: 4.9,
  },
];

export function getStaffById(id: string): Staff | undefined {
  return MOCK_STAFF.find((s) => s.id === id);
}
