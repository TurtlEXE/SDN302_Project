import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { FacilitiesPage } from '../FacilitiesPage.jsx';
import { facilityService } from '../../../services/facility.service.js';
import { sportService } from '../../../services/sport.service.js';

vi.mock('../../../services/facility.service.js', () => ({
  facilityService: {
    getPublicFacilities: vi.fn(),
  },
}));

vi.mock('../../../services/sport.service.js', () => ({
  sportService: {
    getPublicSports: vi.fn(),
  },
}));

describe('FacilitiesPage Component (P16)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sportService.getPublicSports.mockResolvedValue({ success: true, data: [] });
  });

  it('renders facilities list and pagination count when loaded', async () => {
    facilityService.getPublicFacilities.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'fac-1',
          name: 'Sân bóng Mỹ Đình',
          address: 'Lê Đức Thọ, Nam Từ Liêm',
          province: 'Hà Nội',
          openTime: '06:00',
          closeTime: '23:00',
          minPrice: 150000,
        },
      ],
      pagination: {
        page: 1,
        limit: 12,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    });

    render(
      <BrowserRouter>
        <FacilitiesPage />
      </BrowserRouter>
    );

    expect(screen.getByText('Khám phá Cơ sở Thể thao')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Sân bóng Mỹ Đình')).toBeInTheDocument();
      expect(screen.queryByText('123 Đội Cấn, Ba Đình')).not.toBeInTheDocument();
      expect(screen.getByTestId('results-count')).toHaveTextContent('Tìm thấy 1 cơ sở phù hợp');
    });
  });

  it('renders empty state when no facilities found', async () => {
    facilityService.getPublicFacilities.mockResolvedValue({
      success: true,
      data: [],
      pagination: {
        page: 1,
        limit: 12,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      },
    });

    render(
      <BrowserRouter>
        <FacilitiesPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Không tìm thấy cơ sở phù hợp')).toBeInTheDocument();
    });
  });
});
