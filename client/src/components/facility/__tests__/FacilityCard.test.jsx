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

  it('renders cover image from coverImageUrl when images array is not provided', () => {
    const facilityWithCoverUrl = {
      id: 'fac-2',
      name: 'Trung Tâm Thể Thao Đa Năng',
      address: '456 Lê Lợi, Đà Nẵng',
      province: 'Đà Nẵng',
      openTime: '07:00',
      closeTime: '21:00',
      minPricePerHour: 150000,
      coverImageUrl: 'https://images.unsplash.com/photo-court-1',
    };

    render(
      <BrowserRouter>
        <FacilityCard facility={facilityWithCoverUrl} />
      </BrowserRouter>
    );

    const img = screen.getByRole('img', { name: 'Trung Tâm Thể Thao Đa Năng' });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://images.unsplash.com/photo-court-1');
  });

  it('renders fallback placeholder icon when no image or coverImageUrl exists', () => {
    const facilityWithoutImage = {
      id: 'fac-3',
      name: 'Sân Tập Không Ảnh',
      address: '789 Trần Hưng Đạo',
      province: 'Hồ Chí Minh',
      openTime: '06:00',
      closeTime: '22:00',
      minPricePerHour: 100000,
    };

    render(
      <BrowserRouter>
        <FacilityCard facility={facilityWithoutImage} />
      </BrowserRouter>
    );

    expect(screen.getByText('SportBooking')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});

