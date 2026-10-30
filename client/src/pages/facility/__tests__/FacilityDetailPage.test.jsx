import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { FacilityDetailPage } from '../FacilityDetailPage.jsx';
import { facilityService } from '../../../services/facility.service.js';

vi.mock('../../../services/facility.service.js', () => ({
  facilityService: {
    getPublicFacilityById: vi.fn(),
    getFacilitySchedule: vi.fn(),
  },
}));

describe('FacilityDetailPage Component (B04 All-in-one Schedule)', () => {
  const mockDetailData = {
    id: 'fac-detail-1',
    name: 'Tổ Hợp Thể Thao Bách Khoa',
    address: '1 Đại Cồ Việt, Hai Bà Trưng',
    province: 'Hà Nội',
    openTime: '06:00',
    closeTime: '22:00',
    phoneNumber: '0987654321',
    description: 'Cơ sở hiện đại, sàn thi đấu đạt chuẩn quốc tế.',
    minPrice: 80000,
    images: [{ id: 'img-1', url: 'https://example.com/bachkhoa.jpg', isCover: true }],
    facilitySports: [
      {
        id: 'fs-1',
        sportId: 'sport-badminton',
        sportName: 'Cầu lông',
        slotStepMinutes: 30,
      },
      {
        id: 'fs-2',
        sportId: 'sport-soccer',
        sportName: 'Bóng đá',
        slotStepMinutes: 60,
      },
    ],
    courts: [
      {
        id: 'court-badminton-1',
        facilitySportId: 'fs-1',
        sportId: 'sport-badminton',
        name: 'Sân Cầu Lông 1',
        pricePerHourVnd: 80000,
      },
      {
        id: 'court-soccer-1',
        facilitySportId: 'fs-2',
        sportId: 'sport-soccer',
        name: 'Sân Bóng Đá 1',
        pricePerHourVnd: 200000,
      },
    ],
  };

  const mockScheduleData = {
    facilityId: 'fac-detail-1',
    facilityName: 'Tổ Hợp Thể Thao Bách Khoa',
    bookingDate: '2026-11-02',
    dayOfWeek: 'monday',
    dayType: 'WEEKDAY',
    isOpen: true,
    openTime: '06:00',
    closeTime: '22:00',
    operatingHoursVersion: 1,
    sports: [
      {
        facilitySportId: 'fs-1',
        sportId: 'sport-badminton',
        sportName: 'Cầu lông',
        slotStepMinutes: 30,
        configVersion: 1,
        courts: [
          {
            courtId: 'court-badminton-1',
            courtName: 'Sân Cầu Lông 1',
            pricePerHourVnd: 80000,
            priceVersion: 1,
            pricingRules: [
              { dayType: 'WEEKDAY', startTime: '06:00', endTime: '22:00', pricePerHourVnd: 80000 },
            ],
            slots: [
              { startTime: '06:00', endTime: '06:30', status: 'AVAILABLE', priceVnd: 40000 },
              { startTime: '06:30', endTime: '07:00', status: 'AVAILABLE', priceVnd: 40000 },
              { startTime: '07:00', endTime: '07:30', status: 'BOOKED', priceVnd: 40000 },
            ],
          },
        ],
      },
      {
        facilitySportId: 'fs-2',
        sportId: 'sport-soccer',
        sportName: 'Bóng đá',
        slotStepMinutes: 60,
        configVersion: 1,
        courts: [
          {
            courtId: 'court-soccer-1',
            courtName: 'Sân Bóng Đá 1',
            pricePerHourVnd: 200000,
            priceVersion: 1,
            pricingRules: [
              { dayType: 'WEEKDAY', startTime: '06:00', endTime: '22:00', pricePerHourVnd: 200000 },
            ],
            slots: [
              { startTime: '06:00', endTime: '07:00', status: 'AVAILABLE', priceVnd: 200000 },
              { startTime: '07:00', endTime: '08:00', status: 'AVAILABLE', priceVnd: 200000 },
            ],
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    facilityService.getPublicFacilityById.mockResolvedValue({
      success: true,
      data: mockDetailData,
    });
    facilityService.getFacilitySchedule.mockResolvedValue({
      success: true,
      data: mockScheduleData,
    });
  });

  it('renders all sports and courts simultaneously without dropdown/step requirement', async () => {
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
      expect(screen.getByText(/1 Đại Cồ Việt/i)).toBeInTheDocument();
      expect(screen.getByText('0987654321')).toBeInTheDocument();
    });

    // Verify all sports are rendered on the same page
    await waitFor(() => {
      expect(screen.getByTestId('sport-schedule-section-fs-1')).toBeInTheDocument();
      expect(screen.getByTestId('sport-schedule-section-fs-2')).toBeInTheDocument();
    });

    // Check step descriptions in Vietnamese
    expect(screen.getByText('Mỗi lượt 30 phút')).toBeInTheDocument();
    expect(screen.getByText('Mỗi lượt 60 phút')).toBeInTheDocument();

    // Check courts are both visible
    expect(screen.getByText('Sân Cầu Lông 1')).toBeInTheDocument();
    expect(screen.getByText('Sân Bóng Đá 1')).toBeInTheDocument();

    // Check slot buttons are directly interactive
    const bdmSlot1 = screen.getByTestId('slot-court-badminton-1-06:00');
    expect(bdmSlot1).toBeInTheDocument();
    expect(bdmSlot1).toBeEnabled();

    // Booked slot is disabled
    const bdmSlot3 = screen.getByTestId('slot-court-badminton-1-07:00');
    expect(bdmSlot3).toBeDisabled();
  });

  it('allows clicking slots, shows summary, and prompts confirmation when switching courts', async () => {
    render(
      <MemoryRouter initialEntries={['/facilities/fac-detail-1']}>
        <Routes>
          <Route path="/facilities/:id" element={<FacilityDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Sân Cầu Lông 1')).toBeInTheDocument();
    });

    // 1. Select first slot of Badminton Court 1
    const bdmSlot1 = screen.getByTestId('slot-court-badminton-1-06:00');
    fireEvent.click(bdmSlot1);

    // Summary appears
    await waitFor(() => {
      expect(screen.getByTestId('selected-ranges-summary')).toBeInTheDocument();
      expect(screen.getByTestId('total-price-vnd')).toHaveTextContent(/40\.000/);
    });

    // 2. Click slot on a DIFFERENT court (Soccer Court 1)
    const soccerSlot1 = screen.getByTestId('slot-court-soccer-1-06:00');
    fireEvent.click(soccerSlot1);

    // Switch Court confirmation modal appears
    await waitFor(() => {
      expect(screen.getByText('Xác nhận chuyển sân')).toBeInTheDocument();
      expect(screen.getByText(/Chuyển sang/i)).toBeInTheDocument();
    });

    // 3. Confirm switch
    const confirmBtn = screen.getByRole('button', { name: 'Xác nhận đổi sân' });
    fireEvent.click(confirmBtn);

    // Summary should now reflect Soccer Court 1 (200k)
    await waitFor(() => {
      const summary = screen.getByTestId('selected-ranges-summary');
      expect(summary).toHaveTextContent(/Sân Bóng Đá 1/i);
      expect(screen.getByTestId('total-price-vnd')).toHaveTextContent(/200\.000/);
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
