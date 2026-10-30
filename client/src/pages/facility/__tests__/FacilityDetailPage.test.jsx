import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { FacilityDetailPage } from '../FacilityDetailPage.jsx';
import { facilityService } from '../../../services/facility.service.js';
import { courtService } from '../../../services/court.service.js';

vi.mock('../../../services/facility.service.js', () => ({
  facilityService: {
    getPublicFacilityById: vi.fn(),
  },
}));

vi.mock('../../../services/court.service.js', () => ({
  courtService: {
    getCourtSchedule: vi.fn(),
  },
}));

describe('FacilityDetailPage Component (P16)', () => {
  const mockDetailData = {
    id: 'fac-detail-1',
    name: 'Tổ Hợp Thể Thao Bách Khoa',
    address: '1 Đại Cồ Việt, Hai Bà Trưng',
    province: 'Hà Nội',
    openTime: '06:00',
    closeTime: '22:00',
    phoneNumber: '0987654321',
    description: 'Cơ sở hiện đại, sàn thi đấu đạt chuẩn quốc tế.',
    minPrice: 100000,
    images: [{ id: 'img-1', url: 'https://example.com/bachkhoa.jpg', isCover: true }],
    facilitySports: [
      {
        id: 'fs-1',
        sportId: 'sport-soccer',
        sportName: 'Bóng đá',
        slotStepMinutes: 60,
      },
      {
        id: 'fs-2',
        sportId: 'sport-badminton',
        sportName: 'Cầu lông',
        slotStepMinutes: 30,
      },
    ],
    courts: [
      {
        id: 'court-soccer-1',
        facilitySportId: 'fs-1',
        sportId: 'sport-soccer',
        name: 'Sân bóng số 1',
        pricePerHourVnd: 250000,
      },
      {
        id: 'court-badminton-1',
        facilitySportId: 'fs-2',
        sportId: 'sport-badminton',
        name: 'Sân cầu lông A',
        pricePerHourVnd: 100000,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    facilityService.getPublicFacilityById.mockResolvedValue({
      success: true,
      data: mockDetailData,
    });
    courtService.getCourtSchedule.mockResolvedValue({
      success: true,
      data: {
        courtId: 'court-soccer-1',
        courtName: 'Sân bóng số 1',
        bookingDate: '2026-11-01',
        openTime: '06:00',
        closeTime: '22:00',
        slotStepMinutes: 60,
        pricePerHourVnd: 250000,
        slots: [
          { startTime: '06:00', endTime: '07:00', status: 'AVAILABLE' },
          { startTime: '07:00', endTime: '08:00', status: 'AVAILABLE' },
        ],
      },
    });
  });

  it('renders facility information, sport tabs, court tabs and schedule', async () => {
    render(
      <MemoryRouter initialEntries={['/facilities/fac-detail-1']}>
        <Routes>
          <Route path="/facilities/:id" element={<FacilityDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Initial loading indicator
    expect(screen.getByText(/Đang tải thông tin/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: 'Tổ Hợp Thể Thao Bách Khoa' })
      ).toBeInTheDocument();
      expect(screen.getByText('1 Đại Cồ Việt, Hai Bà Trưng')).toBeInTheDocument();
      expect(screen.getByText('0987654321')).toBeInTheDocument();
    });

    // Check sport tabs
    expect(screen.getByTestId('sport-tab-sport-soccer')).toBeInTheDocument();
    expect(screen.getByTestId('sport-tab-sport-badminton')).toBeInTheDocument();

    // Default first sport selected: soccer court visible
    expect(screen.getByTestId('court-tab-court-soccer-1')).toBeInTheDocument();

    // Switch to badminton sport
    fireEvent.click(screen.getByTestId('sport-tab-sport-badminton'));

    await waitFor(() => {
      expect(screen.getByTestId('court-tab-court-badminton-1')).toBeInTheDocument();
    });
  });

  it('handles 404 or error gracefully', async () => {
    facilityService.getPublicFacilityById.mockRejectedValue(
      new Error('Không tìm thấy cơ sở thể thao.')
    );

    render(
      <MemoryRouter initialEntries={['/facilities/fac-nonexistent']}>
        <Routes>
          <Route path="/facilities/:id" element={<FacilityDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Không tìm thấy cơ sở thể thao')).toBeInTheDocument();
    });
  });
});
