import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { FacilityCard } from '../FacilityCard.jsx';

describe('FacilityCard Component (P16)', () => {
  const mockFacility = {
    id: 'fac-1',
    name: 'CLB Cầu Lông Ba Đình',
    address: '123 Đội Cấn, Ba Đình',
    province: 'Hà Nội',
    openTime: '06:00',
    closeTime: '22:00',
    minPrice: 80000,
    images: [{ url: 'https://example.com/court.jpg', isCover: true }],
  };

  it('renders facility information and formatted starting price', () => {
    render(
      <BrowserRouter>
        <FacilityCard facility={mockFacility} />
      </BrowserRouter>
    );

    expect(screen.getByText('CLB Cầu Lông Ba Đình')).toBeInTheDocument();
    expect(screen.getByText('123 Đội Cấn, Ba Đình')).toBeInTheDocument();
    expect(screen.getByText('Hà Nội')).toBeInTheDocument();
    expect(screen.getByText('06:00 - 22:00')).toBeInTheDocument();
    expect(screen.getByText(/80\.000/)).toBeInTheDocument();
  });

  it('links to the facility detail page /facilities/:id', () => {
    render(
      <BrowserRouter>
        <FacilityCard facility={mockFacility} />
      </BrowserRouter>
    );

    const link = screen.getByRole('link', { name: /xem lịch & đặt sân/i });
    expect(link).toHaveAttribute('href', '/facilities/fac-1');
  });
});

